"""BashGames backend (FastAPI on 127.0.0.1:8300, behind Caddy at games.bashir.my.id).
The static app is served by Caddy; this serves /api and the /ws game connections."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import random
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import awards, config, content, push, util, wallet
from .games import CATEGORIES, GAMES, ORDER
from .pb import PBError, pb, q
from .rooms import ROOMS

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("bg")

COOKIE = "bg_session"
AVATARS = ["🐱", "🐶", "🐼", "🦊", "🐨", "🐯", "🦁", "🐸", "🐵", "🐰", "🐻", "🐷", "🐧", "🦄", "🐙", "🐢", "🦉", "🐹",
           "🐮", "🐔", "🦖", "🐳", "🦋", "🐝", "🦥", "🦦", "🐞", "🦩"]
COLORS = ["#e0655a", "#f0a04b", "#e9c46a", "#7cb87a", "#4fa89b", "#5b9bd5", "#7d7fd6", "#b77fd1", "#e27aa8", "#8d6e63",
          "#5f7a8c", "#c9a227"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ROOMS.restore()
    tasks = [asyncio.create_task(ROOMS.sweep())]
    if not config.DEV:  # the question-bank filler spends the (shared) free Gemini quota: production only
        tasks.append(asyncio.create_task(content.filler()))
    yield
    for t in tasks:
        t.cancel()
    for room in list(ROOMS.rooms.values()):
        if room.dirty:
            await room.save()
    await pb.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    body = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
    return JSONResponse(body, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(x) for x in first.get("loc", ["", "input"])[1:]) or "input"
    return JSONResponse({"error": f"Invalid {field}: {first.get('msg', 'bad value')}."}, status_code=400)


@app.exception_handler(PBError)
async def pb_error(request: Request, exc: PBError):
    log.warning("pocketbase error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse({"error": exc.field_error()}, status_code=400 if exc.status < 500 else 502)


@app.middleware("http")
async def csrf_and_cache(request: Request, call_next):
    if request.method not in ("GET", "HEAD") and request.url.path.startswith("/api/") and request.headers.get("x-bg") != "1":
        return JSONResponse({"error": "Missing request header."}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("Cache-Control", "no-store")
    return response


# ---------------------------------------------------------------------------------------------------------
# Sessions (shared household accounts, same approval as the other apps)
# ---------------------------------------------------------------------------------------------------------

@dataclass
class Session:
    user: dict
    token: str

    @property
    def id(self) -> str:
        return self.user["id"]

    @property
    def is_admin(self) -> bool:
        return self.user.get("role") == "admin"


_cache: OrderedDict[str, tuple[float, dict, str]] = OrderedDict()


async def verify(token: str) -> tuple[dict, str] | None:
    hit = _cache.get(token)
    if hit and time.monotonic() - hit[0] < 60:
        return hit[1], hit[2]
    status, data = await pb.raw("POST", "/api/collections/users/auth-refresh", token)
    if status != 200 or "token" not in data or (data["record"].get("role") or "") not in ("", "admin"):
        _cache.pop(token, None)
        return None
    for t in (token, data["token"]):
        _cache[t] = (time.monotonic(), data["record"], data["token"])
        _cache.move_to_end(t)
    while len(_cache) > 300:
        _cache.popitem(last=False)
    return data["record"], data["token"]


def set_session(response: Response, token: str):
    response.set_cookie(COOKIE, token, max_age=60 * 24 * 3600, httponly=True, secure=not config.DEV, samesite="strict",
                        path="/")


async def current(request: Request, response: Response) -> Session:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Please log in.")
    res = await verify(token)
    if not res:
        response.delete_cookie(COOKIE, path="/")
        raise HTTPException(401, "Your session has ended. Please log in again.")
    user, fresh = res
    if fresh != token:
        set_session(response, fresh)
    return Session(user, fresh)


async def admin_only(s: Session = Depends(current)) -> Session:
    if not s.is_admin:
        raise HTTPException(403, "Admins only.")
    return s


async def profile_of(user: dict) -> dict:
    rec = await pb.first("bg_profiles", f"user = {q(user['id'])}")
    if not rec:
        rec = await pb.create("bg_profiles", {"user": user["id"], "name": user.get("username", "")[:20],
                                              "avatar": random.choice(AVATARS), "color": random.choice(COLORS),
                                              "lang": "id", "prefs": {"sound": True, "volume": 70, "timer": 60}})
    return {"id": user["id"], "username": user.get("username", ""), "name": rec.get("name") or user.get("username", ""),
            "avatar": rec.get("avatar") or "🙂", "color": rec.get("color") or "#888", "lang": rec.get("lang") or "id",
            "prefs": rec.get("prefs") or {}, "admin": user.get("role") == "admin"}


login_limit = util.Window(10, 600)
register_limit = util.Window(5, 3600)


def ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=72)


@app.post("/api/register")
async def register(body: Credentials, request: Request):
    register_limit.check(ip(request), "sign-ups")
    username = body.username.strip().lower()
    if not all(c.isalnum() or c == "_" for c in username) or not username.isascii():
        raise HTTPException(400, "Username: letters, numbers or _ only.")
    status, data = await pb.raw("POST", "/api/collections/users/records", json={
        "username": username, "email": f"{username}@users.lyrsync.local", "password": body.password,
        "passwordConfirm": body.password})
    if status == 200:
        return {"status": "pending"}
    fields = (data or {}).get("data") or {}
    if "username" in fields:
        raise HTTPException(409, "That username is taken.")
    raise HTTPException(400, "Could not create the account.")


@app.post("/api/login")
async def login(body: Credentials, request: Request, response: Response):
    if not config.DEV:
        login_limit.check(ip(request), "login attempts")
    status, data = await pb.raw("POST", "/api/collections/users/auth-with-password",
                                json={"identity": body.username.strip().lower(), "password": body.password})
    if status == 403:
        raise HTTPException(403, "Your account is waiting for approval.")
    if status != 200 or (data["record"].get("role") or "") not in ("", "admin"):
        raise HTTPException(401, "Wrong username or password.")
    set_session(response, data["token"])
    return {"me": await profile_of(data["record"])}


@app.post("/api/logout")
async def logout(request: Request, response: Response):
    _cache.pop(request.cookies.get(COOKIE, ""), None)
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@app.get("/api/me")
async def me(s: Session = Depends(current)):
    return {"me": await profile_of(s.user), "avatars": AVATARS, "colors": COLORS}


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=20)
    avatar: str | None = Field(default=None, max_length=8)
    color: str | None = Field(default=None, max_length=9)
    lang: str | None = Field(default=None, pattern="^(id|en)$")
    prefs: dict | None = None


@app.put("/api/me")
async def update_me(body: ProfileIn, s: Session = Depends(current)):
    await profile_of(s.user)
    rec = await pb.first("bg_profiles", f"user = {q(s.id)}")
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if "avatar" in data and data["avatar"] not in AVATARS:
        data.pop("avatar")
    if "color" in data and data["color"] not in COLORS:
        data.pop("color")
    if "prefs" in data:
        p = data["prefs"]
        data["prefs"] = {**(rec.get("prefs") or {}), "sound": bool(p.get("sound", True)),
                         "volume": max(0, min(100, int(p.get("volume", 70)))),
                         "timer": max(0, min(600, int(p.get("timer", 60))))}
    await pb.update("bg_profiles", rec["id"], data)
    return {"me": await profile_of(s.user)}


class PasswordIn(BaseModel):
    old: str = Field(min_length=1, max_length=72)
    new: str = Field(min_length=8, max_length=72)


@app.post("/api/password")
async def password(body: PasswordIn, response: Response, s: Session = Depends(current)):
    status, _ = await pb.raw("PATCH", f"/api/collections/users/records/{s.id}", s.token,
                             json={"oldPassword": body.old, "password": body.new, "passwordConfirm": body.new})
    if status != 200:
        raise HTTPException(400, "Current password is wrong.")
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True, "relogin": True}


# ---------------------------------------------------------------------------------------------------------
# Games and rooms
# ---------------------------------------------------------------------------------------------------------

@app.get("/api/games")
async def games(s: Session = Depends(current)):
    return {"games": [{"key": g.key, "name_id": g.name_id, "name_en": g.name_en, "icon": g.icon, "min": g.min_players,
                       "max": g.max_players, "kind": g.kind, "santai": g.santai_ok, "teams": g.teams,
                       "timer": g.default_timer, "options": g.options} for g in ORDER],
            "categories": [{"key": k, "id": v[0], "en": v[1], "games": v[2]} for k, v in CATEGORIES.items()]}


class RoomIn(BaseModel):
    game: str = Field(max_length=30)
    mode: str = Field(default="live", pattern="^(live|santai)$")
    options: dict = Field(default_factory=dict)


@app.post("/api/rooms")
async def create_room(body: RoomIn, s: Session = Depends(current)):
    if body.game not in GAMES:
        raise HTTPException(400, "Unknown game.")
    prof = await profile_of(s.user)
    opts = dict(body.options)
    if "_timer" not in opts:
        general = int((prof["prefs"] or {}).get("timer", 60))
        opts["_timer"] = general if general else 0
    room = await ROOMS.create(body.game, body.mode, s.id, opts)
    return {"code": room.code}


@app.get("/api/rooms")
async def rooms(s: Session = Depends(current)):
    return {"rooms": ROOMS.list_for(s.id)}


@app.get("/api/rooms/{code}")
async def room_info(code: str, s: Session = Depends(current)):
    room = await ROOMS.get(code)
    if not room or room.status == "closed":
        raise HTTPException(404, "Room not found.")
    return {"room": room.room_info()}


# ---- photo games: photos go up over HTTPS (too big for the game socket) and stay in the room's memory ----
PHOTO_MAX = 6_000_000
photo_last: dict[str, float] = {}


def clean_jpeg(raw: bytes) -> bytes:
    """Re-encode: right way up, max 768 px, no EXIF (no location or camera data leaves the phone's photo)."""
    from PIL import Image, ImageOps
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((768, 768))
    out = io.BytesIO()
    im.save(out, "JPEG", quality=80, optimize=True)
    return out.getvalue()


@app.post("/api/rooms/{code}/photo")
async def room_photo(code: str, request: Request, r: int, s: Session = Depends(current)):
    room = await ROOMS.get(code)
    if not room or not room.game or not room.seat_of(s.id) or not hasattr(room.game, "photo_ok"):
        raise HTTPException(404, "Room not found.")
    now = time.monotonic()
    if now - photo_last.get(s.id, 0) < 2:
        raise HTTPException(429, "Sebentar…")
    photo_last[s.id] = now
    why = room.game.photo_ok(s.id, r)
    if why:
        raise HTTPException(409, why)
    raw = await request.body()
    if not raw or len(raw) > PHOTO_MAX:
        raise HTTPException(413, "Foto terlalu besar.")
    try:
        jpeg = await asyncio.to_thread(clean_jpeg, raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Itu bukan foto.") from None
    room.keep_photo(f"{r}:{s.id}", jpeg)
    await room.server_input(s.id, {"do": "photo", "r": r})
    check = getattr(room.cls, "check_photo", None)
    if check:
        async def run():
            try:
                res = await check(room.game, jpeg)
            except Exception:  # noqa: BLE001
                log.exception("photo check failed")
                res = {"ok": True, "what": "", "comment": ""}
            await room.server_input(s.id, {"do": "checked", "r": r, **res})
        asyncio.create_task(run())
    return {"ok": True}


@app.get("/api/rooms/{code}/photo/{r}/{uid}")
async def room_photo_get(code: str, r: int, uid: str, s: Session = Depends(current)):
    room = await ROOMS.get(code)
    if not room or not (room.seat_of(s.id) or s.id in room.conns):
        raise HTTPException(404, "Not found.")
    jpeg = room.photos.get(f"{r}:{uid}")
    if not jpeg:
        raise HTTPException(404, "Not found.")
    return Response(jpeg, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=600"})


class InviteIn(BaseModel):
    users: list[str] = Field(max_length=10)


@app.post("/api/rooms/{code}/invite")
async def invite(code: str, body: InviteIn, s: Session = Depends(current)):
    room = await ROOMS.get(code)
    if not room:
        raise HTTPException(404, "Room not found.")
    prof = await profile_of(s.user)
    g = GAMES[room.game_key]
    sent = 0
    for uid in body.users:
        if util.PB_ID.match(uid) and uid != s.id:
            sent += await push.send(f"{prof['avatar']} {prof['name']} mengajak main {g.icon} {g.name_id}",
                                    f"Ruang {room.code} — tap untuk gabung!", f"/#room/{room.code}", tag=f"invite-{room.code}",
                                    users=[uid])
    return {"sent": sent}


@app.get("/api/players")
async def players(s: Session = Depends(current)):
    profs = await pb.all("bg_profiles", fields="user,name,avatar,color", sort="name")
    online = ROOMS.online_ids()
    return {"players": [{"id": p["user"], "name": p["name"], "avatar": p["avatar"], "color": p["color"],
                         "online": p["user"] in online} for p in profs]}


@app.get("/api/wallet")
async def my_wallet(s: Session = Depends(current)):
    return {"balance": await wallet.balance(s.id), "daily": wallet.DAILY}


# ---------------------------------------------------------------------------------------------------------
# Stats, leaderboards, titles, history
# ---------------------------------------------------------------------------------------------------------

@app.get("/api/stats")
async def stats(game: str = "", s: Session = Depends(current)):
    items = await awards.matches(game=game if game in GAMES else "")
    mine = [m for m in items if any(p["id"] == s.id for p in m.get("players") or [])]
    wins = sum(1 for m in mine if s.id in (m.get("winners") or []))
    per_game: dict[str, dict] = {}
    h2h: dict[str, dict] = {}
    for m in mine:
        g = per_game.setdefault(m["game"], {"game": m["game"], "played": 0, "wins": 0})
        g["played"] += 1
        me_p = next(p for p in m["players"] if p["id"] == s.id)
        if s.id in (m.get("winners") or []):
            g["wins"] += 1
        for p in m["players"]:
            if p["id"] == s.id:
                continue
            h = h2h.setdefault(p["id"], {"id": p["id"], "name": p["name"], "avatar": p.get("avatar"), "color": p.get("color"),
                                         "won": 0, "lost": 0, "games": 0})
            h["games"] += 1
            if me_p["rank"] < p["rank"]:
                h["won"] += 1
            elif me_p["rank"] > p["rank"]:
                h["lost"] += 1
    streak = 0
    for m in mine:
        if s.id in (m.get("winners") or []):
            streak += 1
        else:
            break
    return {"played": len(mine), "wins": wins, "rate": round(100 * wins / len(mine)) if mine else 0, "streak": streak,
            "per_game": sorted(per_game.values(), key=lambda g: -g["played"]), "h2h": sorted(h2h.values(), key=lambda h: -h["games"]),
            "recent": [{"id": m["id"], "game": m["game"], "ended": m["ended"], "players": m["players"], "winners": m["winners"]}
                       for m in mine[:30]]}


@app.get("/api/leaderboard")
async def board(game: str = "", period: str = "all", s: Session = Depends(current)):
    since = ""
    if period == "month":
        since = util.now_local().replace(day=1, hour=0, minute=0, second=0, microsecond=0) \
            .astimezone(__import__("datetime").timezone.utc).strftime("%Y-%m-%d %H:%M:%S.000Z")
    items = await awards.matches(since, game if game in GAMES else "")
    return {"rows": awards.leaderboard(items), "titles": await awards.titles_this_month()}


@app.get("/api/matches/{mid}")
async def match(mid: str, s: Session = Depends(current)):
    return await pb.get("bg_matches", util.rid(mid))


# ---------------------------------------------------------------------------------------------------------
# Loser dares
# ---------------------------------------------------------------------------------------------------------

class DareIn(BaseModel):
    text: str = Field(min_length=3, max_length=300)


@app.get("/api/dares")
async def dares(s: Session = Depends(current)):
    custom = await pb.all("bg_dares", sort="-created")
    log_ = await pb.all("bg_dare_log", sort="-created", expand="user", fields="id,user,game,text,done,created,done_at")
    profs = {p["user"]: p for p in await pb.all("bg_profiles", fields="user,name,avatar,color")}
    return {"custom": custom, "defaults": [{"id": a, "en": b} for a, b in awards.DEFAULT_DARES],
            "log": [{**d, "name": profs.get(d["user"], {}).get("name", "?"), "avatar": profs.get(d["user"], {}).get("avatar", "")}
                    for d in log_[:100]]}


@app.post("/api/dares")
async def add_dare(body: DareIn, s: Session = Depends(current)):
    prof = await profile_of(s.user)
    return await pb.create("bg_dares", {"text": body.text.strip(), "lang": "id", "source": "custom", "by": prof["name"],
                                        "active": True})


@app.delete("/api/dares/{did}")
async def delete_dare(did: str, s: Session = Depends(current)):
    await pb.delete("bg_dares", util.rid(did))
    return {"ok": True}


class DoneIn(BaseModel):
    done: bool


@app.patch("/api/dares/log/{did}")
async def dare_done(did: str, body: DoneIn, s: Session = Depends(current)):
    return await pb.update("bg_dare_log", util.rid(did), {"done": body.done, "done_at": util.pb_now() if body.done else ""})


# ---------------------------------------------------------------------------------------------------------
# Reported questions (admin review)
# ---------------------------------------------------------------------------------------------------------

@app.get("/api/reports")
async def reports(s: Session = Depends(current)):
    reps = await pb.all("bg_reports", sort="-created", expand="question")
    return {"reports": [{"id": r["id"], "reason": r["reason"], "kind": r["kind"], "topic": r["topic"], "status": r["status"],
                         "created": r["created"], "question": (r.get("expand") or {}).get("question")} for r in reps[:200]]}


class ReviewIn(BaseModel):
    action: str = Field(pattern="^(restore|delete|dismiss)$")


@app.patch("/api/reports/{rid_}")
async def review(rid_: str, body: ReviewIn, s: Session = Depends(admin_only)):
    rep = await pb.get("bg_reports", util.rid(rid_))
    qid = rep.get("question")
    if body.action == "restore" and qid:
        await pb.update("bg_questions", qid, {"status": "ok"})
    if body.action == "delete" and qid:
        await pb.update("bg_questions", qid, {"status": "rejected"})
    await pb.update("bg_reports", rid_, {"status": body.action})
    return {"ok": True}


# ---------------------------------------------------------------------------------------------------------
# Approvals (admin): same users as lyrsync/finance; uses the admin's own login
# ---------------------------------------------------------------------------------------------------------

@app.get("/api/admin/users")
async def admin_users(s: Session = Depends(admin_only)):
    status, data = await pb.raw("GET", "/api/collections/users/records", s.token, params={
        "perPage": 200, "sort": "approved,-created", "filter": "role = '' || role = 'admin'",
        "fields": "id,username,approved,role,created"})
    if status != 200:
        raise HTTPException(502, "Could not load users.")
    return {"users": data.get("items", [])}


class ApproveIn(BaseModel):
    approved: bool


@app.patch("/api/admin/users/{uid}")
async def approve(uid: str, body: ApproveIn, s: Session = Depends(admin_only)):
    status, _ = await pb.raw("PATCH", f"/api/collections/users/records/{util.rid(uid)}", s.token,
                             json={"approved": body.approved})
    if status != 200:
        raise HTTPException(400, "Could not update that user.")
    _cache.clear()
    return {"ok": True}


# ---------------------------------------------------------------------------------------------------------
# Push
# ---------------------------------------------------------------------------------------------------------

class SubIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)
    p256dh: str = Field(min_length=10, max_length=200)
    auth: str = Field(min_length=5, max_length=100)
    ua: str = Field(default="", max_length=300)


@app.get("/api/push/key")
async def push_key(s: Session = Depends(current)):
    return {"key": push.public_key()}


@app.post("/api/push/subscribe")
async def push_subscribe(body: SubIn, s: Session = Depends(current)):
    if not body.endpoint.startswith("https://"):
        raise HTTPException(400, "Bad endpoint.")
    existing = await pb.first("bg_push_subs", f"endpoint = {q(body.endpoint)}")
    data = {**body.model_dump(), "user": s.id}
    if existing:
        await pb.update("bg_push_subs", existing["id"], data)
    else:
        await pb.create("bg_push_subs", data)
    return {"ok": True}


@app.post("/api/push/test")
async def push_test(s: Session = Depends(current)):
    return {"sent": await push.send("BashGames 🎲", "Notifikasi aktif! Kamu akan dapat ajakan main di sini.", "/",
                                    tag="test", users=[s.id])}


@app.get("/api/health")
async def health():
    return {"ok": True, "rooms": len(ROOMS.rooms)}


# ---------------------------------------------------------------------------------------------------------
# The live connection
# ---------------------------------------------------------------------------------------------------------

async def ws_user(websocket: WebSocket) -> dict | None:
    """Same-origin check + session cookie; closes the socket and returns None when not allowed."""
    origin = websocket.headers.get("origin", "")
    host = urlparse(origin).netloc
    if host != urlparse(config.PUBLIC_URL).netloc and not (config.DEV and host.startswith(("127.0.0.1", "localhost"))):
        await websocket.close(code=4403)
        return None
    token = websocket.cookies.get(COOKIE, "")
    res = await verify(token) if token else None
    if not res:
        await websocket.close(code=4401)
        return None
    return res[0]


@app.websocket("/ws/lobby")
async def ws_lobby(websocket: WebSocket):
    """The home page: pushed room list + who's online (nothing is accepted from the client except pings)."""
    user = await ws_user(websocket)
    if not user:
        return
    await websocket.accept()
    await ROOMS.lobby_join(websocket, user["id"])
    try:
        while True:
            raw = await websocket.receive_text()
            if raw == "ping":
                await websocket.send_text('{"t":"pong"}')
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("lobby ws error")
    finally:
        ROOMS.lobby_leave(websocket)


@app.websocket("/ws/{code}")
async def ws(websocket: WebSocket, code: str):
    user = await ws_user(websocket)
    if not user:
        return
    room = await ROOMS.get(code)
    if not room or room.status == "closed":
        await websocket.close(code=4404)
        return
    await websocket.accept()
    prof = await profile_of(user)
    await room.join(websocket, user, prof)
    budget, window = 0, time.monotonic()
    try:
        while True:
            raw = await websocket.receive_text()
            now = time.monotonic()
            if now - window > 1:
                budget, window = 0, now
            budget += 1
            if budget > 80 or len(raw) > 20000:  # flood guard
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if isinstance(msg, dict):
                await room.handle(websocket, user["id"], msg)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("ws error")
    finally:
        await room.leave_socket(websocket, user["id"])


if config.DEV:  # in production Caddy serves the app
    import os

    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "..", "..", "web"), html=True), name="web")
