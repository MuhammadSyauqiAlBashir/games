"""Rooms: the live shared table.

One Room per game table. Players connect over WebSocket; every move goes to the
server, the game engine checks it, and everyone gets their own updated view.

Live mode (default): if a seated player disconnects, the game pauses for all;
when everybody is back and taps Ready, a 3-2-1 countdown resumes it. The game
clock stops while paused, so no timer runs out.
Santai mode (turn-based games only): no pausing, no turn timer; players move
whenever they like and get a push when it's their turn.

Rooms are saved to PocketBase (bg_rooms) so a server restart doesn't lose games."""

from __future__ import annotations

import asyncio
import json
import logging
import random
import secrets
import time
from collections import deque
from fastapi import WebSocket

from . import awards, push, util
from .games import GAMES, IllegalMove
from .pb import PBError, pb, q

log = logging.getLogger("bg.rooms")

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"
PAUSE_GRACE = {"realtime": 3.0, "timed": 4.0, "turn": 5.0}
COUNTDOWN = 3.0
LOOP_DT = 0.2


class Room:
    def __init__(self, code: str, game_key: str, mode: str, host: str, options: dict):
        self.code = code
        self.game_key = game_key
        self.cls = GAMES[game_key]
        self.mode = mode if (mode == "santai" and self.cls.santai_ok) else "live"
        self.host = host
        self.options = options
        self.seats: list[dict] = []
        self.conns: dict[str, set[WebSocket]] = {}
        self.names: dict[str, dict] = {}  # profile snapshot per connected user (spectators too)
        self.status = "lobby"
        self.game = None
        self.rng = random.Random(secrets.randbits(64))
        self.chat: deque = deque(maxlen=100)
        self.started_at = 0.0          # wall time the match began (for records)
        self.clock_base = 0.0          # game clock value at `run_since`
        self.run_since: float | None = None  # monotonic time the clock last started running
        self.ready_resume: set[str] = set()
        self.countdown_end: float | None = None
        self.countdown_kind = ""
        self.gone_since: dict[str, float] = {}
        self.turn_marker: tuple | None = None
        self.turn_deadline: float | None = None
        self.seq = 0
        self.dirty = False
        self.last_save = 0.0
        self.last_seen = time.monotonic()
        self.end_info: dict | None = None
        self.rematch: set[str] = set()
        self.lock = asyncio.Lock()
        self.task: asyncio.Task | None = None
        self.pending_needs: set[str] = set()
        self.frame_no = 0
        self.prefetch_task: asyncio.Task | None = None
        self.prefetch_key = ""

    # ---- clock ----------------------------------------------------------------------
    def clock(self) -> float:
        if self.run_since is None:
            return self.clock_base
        return self.clock_base + (time.monotonic() - self.run_since)

    def clock_run(self):
        if self.run_since is None:
            self.run_since = time.monotonic()

    def clock_stop(self):
        if self.run_since is not None:
            self.clock_base = self.clock()
            self.run_since = None

    # ---- people -----------------------------------------------------------------------
    def seat_of(self, uid: str) -> dict | None:
        return next((s for s in self.seats if s["id"] == uid), None)

    def online(self, uid: str) -> bool:
        return bool(self.conns.get(uid))

    @property
    def timer(self) -> int:
        if self.mode == "santai" or self.cls.kind != "turn":
            return 0
        try:
            return max(0, int(self.options.get("_timer", self.cls.default_timer)))
        except (TypeError, ValueError):
            return 0

    def assign_teams(self):
        """Team games (Sequence): 4 players play as 2 teams of 2 (alternating seats); otherwise everyone solo."""
        n = len(self.seats)
        for i, s in enumerate(self.seats):
            s["team"] = i % 2 if (self.cls.teams and n == 4) else i

    # ---- messages ---------------------------------------------------------------------
    def room_info(self) -> dict:
        return {
            "code": self.code, "game": self.game_key, "mode": self.mode, "host": self.host, "status": self.status,
            "options": {k: v for k, v in self.options.items() if not k.startswith("__")},
            "seats": [{**s, "online": self.online(s["id"])} for s in self.seats],
            "spectators": [self.names[u] for u in self.conns if self.conns[u] and not self.seat_of(u) and u in self.names],
            "min": self.cls.min_players, "max": self.cls.max_players, "timer": self.timer,
            "ready_resume": sorted(self.ready_resume), "countdown": max(0.0, self.countdown_end - time.monotonic())
            if self.countdown_end else 0, "countdown_kind": self.countdown_kind,
            "rematch": sorted(self.rematch), "end": self.end_info,
        }

    def state_msg(self, uid: str | None, events: list | None = None) -> dict:
        view = self.game.view(uid if self.seat_of(uid or "") else None) if self.game else None
        # Events addressed to one player ("to") are only sent to that player.
        mine = [e for e in (events or []) if not e.get("to") or e.get("to") == uid]
        return {"t": "state", "seq": self.seq, "clock": round(self.clock(), 3), "paused": self.status == "paused",
                "view": view, "events": mine, "turn_deadline": self.turn_deadline}

    async def send(self, ws: WebSocket, msg: dict):
        try:
            await ws.send_text(json.dumps(msg, separators=(",", ":"), default=str))
        except Exception:  # noqa: BLE001 - a dead socket is cleaned up by its reader
            pass

    async def broadcast_room(self):
        info = {"t": "room", "room": self.room_info()}
        for socks in list(self.conns.values()):
            for ws in list(socks):
                await self.send(ws, info)

    async def broadcast_state(self, events: list | None = None):
        self.seq += 1
        for uid, socks in list(self.conns.items()):
            if not socks:
                continue
            msg = self.state_msg(uid, events)
            for ws in list(socks):
                await self.send(ws, msg)

    async def broadcast(self, msg: dict, skip: WebSocket | None = None):
        text = json.dumps(msg, separators=(",", ":"), default=str)
        for socks in list(self.conns.values()):
            for ws in list(socks):
                if ws is not skip:
                    try:
                        await ws.send_text(text)
                    except Exception:  # noqa: BLE001
                        pass

    # ---- joining / leaving ------------------------------------------------------------
    async def join(self, ws: WebSocket, user: dict, profile: dict):
        uid = user["id"]
        self.last_seen = time.monotonic()
        self.names[uid] = {"id": uid, "name": profile["name"], "avatar": profile["avatar"], "color": profile["color"]}
        self.conns.setdefault(uid, set()).add(ws)
        async with self.lock:
            seat = self.seat_of(uid)
            if seat:
                seat.update({k: profile[k] for k in ("name", "avatar", "color")})
            elif self.status == "lobby" and len(self.seats) < self.cls.max_players:
                self.seats.append({"id": uid, "name": profile["name"], "avatar": profile["avatar"],
                                   "color": profile["color"], "ready": False, "team": len(self.seats)})
                self.assign_teams()
            self.gone_since.pop(uid, None)
            self.dirty = True
            self.schedule_prefetch()
        await self.send(ws, {"t": "hello", "you": uid, "chat": list(self.chat)})
        await self.broadcast_room()
        if self.game:
            await self.send(ws, self.state_msg(uid))
            snap = self.realtime_snapshot(uid)
            if snap:
                await self.send(ws, snap)

    async def leave_socket(self, ws: WebSocket, uid: str):
        socks = self.conns.get(uid)
        if socks:
            socks.discard(ws)
            if not socks:
                self.conns.pop(uid, None)
                if self.seat_of(uid) and self.status in ("playing", "paused"):
                    self.gone_since[uid] = time.monotonic()
        self.last_seen = time.monotonic()
        await self.broadcast_room()

    # ---- client messages ----------------------------------------------------------------
    async def handle(self, ws: WebSocket, uid: str, msg: dict):
        t = msg.get("t")
        self.last_seen = time.monotonic()
        if t == "chat":
            text = str(msg.get("text", "")).strip()[:300]
            if text:
                item = {"id": util.new_id(), "from": uid, "name": self.names.get(uid, {}).get("name", "?"),
                        "text": text, "at": time.time()}
                self.chat.append(item)
                await self.broadcast({"t": "chat", "msg": item})
            return
        if t == "react":
            emoji = str(msg.get("e", ""))[:8]
            if emoji:
                await self.broadcast({"t": "react", "from": uid, "e": emoji})
            return
        if t == "snap":
            snap = self.realtime_snapshot(uid)
            if snap:
                await self.send(ws, snap)
            return
        if t == "ping":
            await self.send(ws, {"t": "pong", "c": msg.get("c")})
            return
        if t == "stroke":  # drawing games: relay + keep in the game state
            await self.on_stroke(ws, uid, msg)
            return
        if t == "input":
            if self.game and self.status == "playing" and self.seat_of(uid):
                self.game.input(uid, msg.get("d") or {}, self.clock())
            return
        async with self.lock:
            await self._handle_locked(ws, uid, t, msg)

    async def _handle_locked(self, ws, uid, t, msg):
        seat = self.seat_of(uid)
        if t == "ready":
            if self.status == "lobby" and seat:
                seat["ready"] = not seat["ready"]
            elif self.status == "paused" and seat:
                self.ready_resume.add(uid)
                if self.all_back() and all(s["id"] in self.ready_resume for s in self.seats):
                    self.start_countdown("resume")
            self.dirty = True
            await self.broadcast_room()
        elif t == "options" and uid == self.host and self.status == "lobby":
            self.set_options(msg.get("options") or {})
            self.schedule_prefetch()
            await self.broadcast_room()
        elif t == "mode" and uid == self.host and self.status == "lobby":
            self.mode = "santai" if msg.get("mode") == "santai" and self.cls.santai_ok else "live"
            self.dirty = True
            await self.broadcast_room()
        elif t == "sit" and self.status == "lobby" and not seat and len(self.seats) < self.cls.max_players:
            p = self.names.get(uid) or {"id": uid, "name": "?", "avatar": "🙂", "color": "#888"}
            self.seats.append({**p, "ready": False, "team": len(self.seats)})
            self.assign_teams()
            await self.broadcast_room()
        elif t == "stand" and self.status == "lobby" and seat:
            self.seats.remove(seat)
            if uid == self.host and self.seats:
                self.host = self.seats[0]["id"]
            self.assign_teams()
            await self.broadcast_room()
        elif t == "swap" and self.status == "lobby" and uid == self.host:
            i, j = int(msg.get("i", -1)), int(msg.get("j", -1))
            if 0 <= i < len(self.seats) and 0 <= j < len(self.seats):
                self.seats[i], self.seats[j] = self.seats[j], self.seats[i]
                self.assign_teams()
                await self.broadcast_room()
        elif t == "kick" and uid == self.host and self.status == "lobby":
            target = self.seat_of(str(msg.get("id")))
            if target and target["id"] != uid:
                self.seats.remove(target)
                self.assign_teams()
                await self.broadcast_room()
        elif t == "start" and uid == self.host and self.status == "lobby":
            await self.try_start(ws)
        elif t == "act":
            await self.on_action(ws, uid, msg.get("a") or {})
        elif t == "drop" and uid == self.host and self.status == "paused":
            # The host gives up waiting for someone who can't come back.
            target = str(msg.get("id"))
            if self.seat_of(target) and not self.online(target) and self.game:
                events = self.game.forfeit(target, self.clock())
                self.gone_since.pop(target, None)
                if self.game.over:
                    await self.finish(events)
                else:
                    await self.after_move(events)
        elif t == "rematch" and self.status == "finished" and seat:
            self.rematch.add(uid)
            if all(s["id"] in self.rematch for s in self.seats if self.online(s["id"])):
                self.back_to_lobby()
            await self.broadcast_room()
        elif t == "end" and uid == self.host and self.status in ("playing", "paused") and self.game:
            # The host ends the game early: rank by the current scores.
            scores = self.game.s.get("scores", {})
            self.game.finish([[x] for x in sorted(self.game.ids(), key=lambda x: -scores.get(x, 0))])
            await self.finish([{"e": "ended_by_host"}])

    def set_options(self, raw: dict):
        allowed = {o["key"]: o for o in self.cls.options}
        for k, v in raw.items():
            if k == "_timer":
                try:
                    self.options["_timer"] = max(0, min(600, int(v)))
                except (TypeError, ValueError):
                    pass
            elif k == "_dare":
                self.options["_dare"] = bool(v)
            elif k in allowed:
                o = allowed[k]
                if o["type"] == "select" and v not in [c[0] for c in o["choices"]]:
                    continue
                if o["type"] == "number":
                    try:
                        v = max(o.get("min", -10**9), min(o.get("max", 10**9), int(v)))
                    except (TypeError, ValueError):
                        continue
                if o["type"] == "bool":
                    v = bool(v)
                if o["type"] == "text":
                    v = str(v)[:500]
                if o["type"] == "multi":
                    valid = [c[0] for c in o["choices"]]
                    v = [x for x in (v or []) if x in valid] or o["default"]
                self.options[k] = v
        self.dirty = True

    # ---- preparing content while players are still in the lobby -----------------------------------
    def content_key(self) -> str:
        # Most content depends only on the options; Tebak Gambar also needs words for every drawer.
        seats = len(self.seats) if getattr(self.cls, "content_per_player", False) else 0
        return json.dumps([self.full_options(), seats], sort_keys=True, default=str)

    def schedule_prefetch(self):
        """Start generating questions/words in the background so pressing Start is instant."""
        if self.status != "lobby" or not getattr(self.cls, "prepare", None) or not getattr(self.cls, "prefetch", True):
            return
        key = self.content_key()
        if key == self.prefetch_key:
            return
        self.prefetch_key = key
        seats, opts = [dict(s) for s in self.seats], self.full_options()
        seed = self.rng.random()

        async def run():
            await asyncio.sleep(1.5)  # settle: options often change several times in a row
            return await self.cls.prepare(seats, opts, random.Random(seed))

        self.prefetch_task = asyncio.create_task(run())
        self.prefetch_task.add_done_callback(lambda t: t.cancelled() or t.exception())

    async def prepared_content(self, opts: dict):
        prep = getattr(self.cls, "prepare", None)
        if not prep:
            return None
        task = self.prefetch_task
        result = None
        if task and self.prefetch_key == self.content_key():
            try:
                result = await asyncio.wait_for(asyncio.shield(task), timeout=15)  # bounded: prepare caps its own AI wait
            except Exception as e:  # noqa: BLE001 - fall back to preparing now
                log.warning("prefetch not usable: %s", e)
        if result is None:
            result = await prep([dict(s) for s in self.seats], opts, self.rng)
        refresh = getattr(self.cls, "refresh", None)
        if refresh:
            result = await refresh(result, opts)
        return result

    def full_options(self) -> dict:
        out = {o["key"]: o["default"] for o in self.cls.options}
        out.update({k: v for k, v in self.options.items()})
        return out

    async def try_start(self, ws):
        n = len(self.seats)
        if n < self.cls.min_players:
            await self.send(ws, {"t": "error", "error": f"Need at least {self.cls.min_players} players."})
            return
        not_ready = [s["name"] for s in self.seats if not s["ready"] and s["id"] != self.host]
        if not_ready:
            await self.send(ws, {"t": "error", "error": "Waiting for: " + ", ".join(not_ready)})
            return
        check = getattr(self.cls, "can_start", None)
        if check:
            problem = await check(self.seats, self.full_options())
            if problem:
                await self.send(ws, {"t": "error", "error": problem})
                return
        self.status = "starting"
        await self.broadcast_room()
        try:
            opts = self.full_options()
            content_ = await self.prepared_content(opts)
            if content_ is not None:
                opts["__content"] = content_
            self.prefetch_task, self.prefetch_key = None, ""
        except Exception as e:  # noqa: BLE001
            log.exception("prepare failed")
            self.status = "lobby"
            await self.send(ws, {"t": "error", "error": f"Couldn't prepare the game: {e}"})
            await self.broadcast_room()
            return
        players = [{"id": s["id"], "name": s["name"], "team": s["team"], "avatar": s["avatar"], "color": s["color"]}
                   for s in self.seats]
        self.clock_base, self.run_since = 0.0, None
        self.pending_needs = set()
        state = self.cls.setup(players, opts, self.rng, 0.0)
        self.game = self.cls(state, self.rng)
        self.started_at = time.time()
        self.end_info = None
        self.rematch = set()
        self.turn_marker = None
        self.turn_deadline = None
        self.start_countdown("start")
        self.dirty = True
        await self.broadcast_room()
        await self.broadcast_state([{"e": "start"}])

    def start_countdown(self, kind: str):
        self.countdown_end = time.monotonic() + COUNTDOWN
        self.countdown_kind = kind
        self.status = "paused"

    def all_back(self) -> bool:
        return all(self.online(s["id"]) for s in self.seats)

    async def on_action(self, ws, uid, a):
        if not self.game or not self.seat_of(uid):
            return
        if self.status != "playing":
            await self.send(ws, {"t": "error", "error": "The game is paused."})
            return
        try:
            events = self.game.act(uid, a, self.clock())
        except IllegalMove as e:
            await self.send(ws, {"t": "error", "error": str(e)})
            return
        except Exception:  # noqa: BLE001
            log.exception("%s: action failed %s", self.game_key, a)
            await self.send(ws, {"t": "error", "error": "Something went wrong with that move."})
            return
        await self.after_move(events)

    async def after_move(self, events: list):
        self.dirty = True
        await self.handle_events(events)
        if self.game.over:
            await self.finish(events)
            return
        try:
            extra = float(self.game.anim_seconds(events))
        except Exception:  # noqa: BLE001
            extra = 0.0
        self.update_turn_timer(extra)
        await self.broadcast_state(events)
        await self.maybe_push_turn()

    async def handle_events(self, events: list):
        """Side effects the engines ask for (reports, wallet changes...)."""
        for ev in events:
            if ev.get("e") == "report":
                asyncio.create_task(self._report(ev))

    async def _report(self, ev):
        from . import content  # noqa: PLC0415
        try:
            await content.report(ev.get("qid", ""), ev.get("who", ""), ev.get("reason", ""), self.code)
        except Exception:  # noqa: BLE001
            log.exception("report failed")

    # ---- the loop -------------------------------------------------------------------------
    def update_turn_timer(self, extra: float = 0.0):
        if not self.game:
            return
        marker = (self.game.turn_no(), tuple(self.game.turn()))
        if marker != self.turn_marker:
            self.turn_marker = marker
            self.turn_deadline = self.clock() + self.timer + extra if (self.timer and self.game.turn()) else None

    async def maybe_push_turn(self):
        if self.mode != "santai" or not self.game:
            return
        for uid in self.game.turn():
            if not self.online(uid):
                key = f"turn:{self.code}:{self.game.turn_no()}:{uid}"
                asyncio.create_task(push.once(key, uid, f"Giliranmu! {self.cls.icon} {self.cls.name_id}",
                                              "Tap untuk melanjutkan permainan.", f"/#room/{self.code}"))

    async def loop(self):
        while True:
            try:
                await asyncio.sleep(1 / self.cls.tick_hz if self.cls.tick_hz and self.status == "playing" else LOOP_DT)
                await self.loop_once()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                log.exception("room %s loop", self.code)
                await asyncio.sleep(1)

    async def loop_once(self):
        now_m = time.monotonic()
        if self.dirty and now_m - self.last_save > 2:
            await self.save()
        if not self.game or self.status == "finished":
            return
        async with self.lock:
            # Countdown to start/resume.
            if self.countdown_end and now_m >= self.countdown_end:
                self.countdown_end = None
                self.countdown_kind = ""
                self.ready_resume = set()
                self.status = "playing"
                self.clock_run()
                self.update_turn_timer()
                await self.broadcast_room()
                await self.broadcast_state([{"e": "resume"}])
                if self.cls.kind == "realtime":
                    await self.broadcast(self.realtime_snapshot(None))
                return
            if self.status != "playing":
                return
            # Live mode: pause when a seated player is gone past the grace period.
            if self.mode == "live":
                grace = PAUSE_GRACE.get(self.cls.kind, 5.0)
                gone = [u for u, since in self.gone_since.items() if now_m - since > grace and not self.online(u)
                        and self.seat_of(u)]
                if gone:
                    self.status = "paused"
                    self.clock_stop()
                    self.ready_resume = set()
                    self.dirty = True
                    await self.broadcast_room()
                    await self.broadcast_state([{"e": "pause", "who": gone}])
                    return
            now = self.clock()
            events: list = []
            if self.cls.kind == "realtime":
                self.game.step(now)
                self.frame_no += 1
                await self.broadcast_frame()
                if self.frame_no % self.cls.tick_hz == 0:
                    await self.broadcast_state([])  # once a second: scores, who's alive
                if self.game.over:
                    await self.finish([])
                return
            events += self.game.tick(now)
            if self.turn_deadline and now >= self.turn_deadline and self.game.turn():
                self.turn_deadline = None
                try:
                    events += self.game.on_timeout(now)
                    events.append({"e": "timeout"})
                except Exception:  # noqa: BLE001
                    log.exception("%s timeout", self.game_key)
            await self.fulfil_needs()
            if events:
                await self.after_move(events)

    async def fulfil_needs(self):
        need = self.game.s.get("ai_need")
        if not need or need.get("id") in self.pending_needs:
            return
        self.pending_needs.add(need["id"])
        asyncio.create_task(self._fulfil(need))

    async def _fulfil(self, need):
        log.info("room %s: working on %s in the background", self.code, need.get("kind"))
        try:
            result = await self.cls.fulfil(need, self.full_options())
        except Exception as e:  # noqa: BLE001
            log.warning("need %s failed: %s", need.get("kind"), e)
            result = None
        async with self.lock:
            if self.game and (self.game.s.get("ai_need") or {}).get("id") == need["id"]:
                events = self.game.provide(need, result, self.clock())
                log.info("room %s: %s done (%s)", self.code, need.get("kind"), events)
                await self.after_move(events)

    # ---- realtime frames ---------------------------------------------------------------------
    async def broadcast_frame(self):
        frame = self.game.frame()
        if frame is None:
            return
        await self.broadcast({"t": "frame", "f": frame, "clock": round(self.clock(), 3)})

    def realtime_snapshot(self, uid):
        if self.game and self.cls.kind == "realtime":
            return {"t": "snap", "s": self.game.snapshot(), "clock": round(self.clock(), 3)}
        return None

    async def on_stroke(self, ws, uid, msg):
        if not self.game or self.status != "playing" or not hasattr(self.game, "stroke"):
            return
        data = msg.get("d") or {}
        ok = self.game.stroke(uid, data, self.clock())
        if ok:
            out = {"t": "stroke", "from": uid, "d": ok}
            # Private canvases (AI judge) aren't broadcast.
            if ok.get("private"):
                return
            await self.broadcast(out, skip=ws)

    # ---- the end -----------------------------------------------------------------------------
    async def finish(self, events):
        g = self.game
        self.status = "finished"
        self.clock_stop()
        self.turn_deadline = None
        results = g.results()
        seats = {s["id"]: s for s in self.seats}
        players = [{"id": r["id"], "name": seats.get(r["id"], {}).get("name", "?"),
                    "avatar": seats.get(r["id"], {}).get("avatar", ""), "color": seats.get(r["id"], {}).get("color", ""),
                    "rank": r["rank"], "score": r.get("score", 0), "team": r.get("team")} for r in results]
        info = {"players": sorted(players, key=lambda p: p["rank"]), "awards": [], "roast": "", "dare": None,
                "titles": []}
        hook = getattr(self.cls, "after_finish", None)
        if hook:
            try:
                info["extra"] = await hook(g, self)
            except Exception:  # noqa: BLE001
                log.exception("after_finish failed")
        try:
            info.update(await awards.on_finish(self, players, g.stats()))
        except Exception:  # noqa: BLE001
            log.exception("awards failed")
        self.end_info = info
        self.dirty = True
        await self.save()
        await self.broadcast_state(events + [{"e": "over"}])
        await self.broadcast_room()

    def back_to_lobby(self):
        self.status = "lobby"
        self.prefetch_key = ""
        self.game = None
        self.end_info = None
        self.rematch = set()
        for s in self.seats:
            s["ready"] = False
        self.seats = [s for s in self.seats if self.online(s["id"])]
        if self.host not in [s["id"] for s in self.seats] and self.seats:
            self.host = self.seats[0]["id"]
        self.clock_base, self.run_since = 0.0, None
        self.dirty = True

    # ---- persistence ------------------------------------------------------------------------------
    def to_record(self) -> dict:
        state = None
        if self.game and self.cls.kind != "realtime":
            state = {"game": self.game.s, "rng": _rng_to_json(self.rng), "clock": self.clock(),
                     "started_at": self.started_at, "turn_left": (self.turn_deadline - self.clock())
                     if self.turn_deadline else None}
        return {"code": self.code, "game": self.game_key, "mode": self.mode,
                "status": self.status if self.status != "starting" else "lobby", "host": self.host,
                "players": self.seats, "options": {k: v for k, v in self.options.items() if k != "__content"},
                "state": {"g": state, "chat": list(self.chat)[-30:], "end": self.end_info}, "seq": self.seq}

    async def save(self):
        self.dirty = False
        self.last_save = time.monotonic()
        data = self.to_record()
        try:
            rec = await pb.first("bg_rooms", f"code = {q(self.code)}")
            if rec:
                await pb.update("bg_rooms", rec["id"], data)
            else:
                await pb.create("bg_rooms", data)
        except PBError as e:
            log.warning("save room %s: %s", self.code, e)
            self.dirty = True

    @classmethod
    def from_record(cls, rec: dict) -> Room | None:
        if rec["game"] not in GAMES:
            return None
        r = cls(rec["code"], rec["game"], rec.get("mode") or "live", rec.get("host") or "", rec.get("options") or {})
        r.seats = rec.get("players") or []
        st = rec.get("state") or {}
        r.chat = deque(st.get("chat") or [], maxlen=100)
        r.end_info = st.get("end")
        g = st.get("g")
        status = rec.get("status") or "lobby"
        if status in ("playing", "paused", "starting") and g and r.cls.kind != "realtime":
            r.rng.setstate(_rng_from_json(g["rng"]))
            r.game = r.cls(g["game"], r.rng)
            r.clock_base = float(g.get("clock") or 0)
            r.started_at = float(g.get("started_at") or time.time())
            r.status = "paused" if r.mode == "live" else "playing"
            if r.mode == "santai":
                r.clock_run()
            r.update_turn_timer()
            for s in r.seats:
                s["ready"] = False
        elif status == "finished":
            r.status = "finished"
        else:
            r.status = "lobby"
            r.game = None
        r.seq = int(rec.get("seq") or 0)
        return r


def _rng_to_json(rng: random.Random) -> list:
    v, internal, gauss = rng.getstate()
    return [v, list(internal), gauss]


def _rng_from_json(data: list) -> tuple:
    return (data[0], tuple(data[1]), data[2])


# ---------------------------------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------------------------------

class Rooms:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.lock = asyncio.Lock()

    def start(self, room: Room):
        self.rooms[room.code] = room
        if not room.task:
            room.task = asyncio.create_task(room.loop())

    async def create(self, game_key: str, mode: str, host: str, options: dict) -> Room:
        async with self.lock:
            for _ in range(50):
                code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
                if code not in self.rooms and not await pb.first("bg_rooms", f"code = {q(code)}"):
                    break
            room = Room(code, game_key, mode, host, {})
            room.set_options(options)
            self.start(room)
            room.schedule_prefetch()
            await room.save()
            return room

    async def get(self, code: str) -> Room | None:
        code = code.upper()
        if code in self.rooms:
            return self.rooms[code]
        rec = await pb.first("bg_rooms", f"code = {q(code)}")
        if not rec or rec.get("status") == "closed":
            return None
        room = Room.from_record(rec)
        if room:
            self.start(room)
        return room

    async def restore(self):
        """Bring back unfinished rooms after a restart."""
        try:
            recs = await pb.all("bg_rooms", filter="status = 'playing' || status = 'paused' || status = 'lobby'",
                                sort="-updated")
        except PBError as e:
            log.warning("restore rooms: %s", e)
            return
        for rec in recs[:100]:
            room = Room.from_record(rec)
            if room:
                self.start(room)
        log.info("restored %d rooms", len(self.rooms))

    async def sweep(self):
        """Close idle rooms (empty lobbies after 1 h, finished after 30 min, live games idle 12 h)."""
        while True:
            await asyncio.sleep(60)
            now = time.monotonic()
            for code, room in list(self.rooms.items()):
                idle = now - room.last_seen
                empty = not any(room.conns.values())
                limit = {"lobby": 3600, "finished": 1800}.get(room.status, 12 * 3600 if room.mode == "live" else 14 * 86400)
                if empty and idle > limit:
                    if room.dirty:
                        await room.save()
                    if room.status in ("lobby", "finished") or idle > limit:
                        room.status = "closed" if room.status in ("lobby", "finished") else room.status
                        if room.status == "closed":
                            await room.save()
                    if room.task:
                        room.task.cancel()
                    self.rooms.pop(code, None)

    def list_for(self, uid: str) -> list[dict]:
        out = []
        for r in self.rooms.values():
            if r.status == "closed":
                continue
            seated = bool(r.seat_of(uid))
            if seated or r.status == "lobby":
                out.append({"code": r.code, "game": r.game_key, "mode": r.mode, "status": r.status, "seated": seated,
                            "players": [{"name": s["name"], "avatar": s["avatar"], "color": s["color"]} for s in r.seats],
                            "host": r.host, "your_turn": bool(r.game and uid in r.game.turn())})
        return out


ROOMS = Rooms()
