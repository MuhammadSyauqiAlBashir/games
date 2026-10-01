"""Photo games (phone camera; the photos live only in the room's memory and are gone when the room ends).

Foto Hunt: "Find something round and red — photograph it!" Gemini checks every photo; the first accepted photo
scores 5, then 3, 2, 1, and every other accepted photo 1. A rejected photo can be retried (4 tries per round).

Ekspresi Challenge: "Most surprised face!" Everyone takes a selfie; when all are in (or time is up) Gemini ranks
the expressions with a kind, funny comment. Only the acting is judged, never anyone's looks.

Photos reach the server through POST /api/rooms/{code}/photo (main.py), which calls `server_input`."""

from __future__ import annotations

import asyncio
import json
import logging
import os

from .. import ai
from .base import Game, IllegalMove, ch, opt, rank_by_score

log = logging.getLogger("bg.photo")
DATA = os.path.join(os.path.dirname(__file__), "..", "data")
LANG_OPT = opt("lang", "Bahasa", "Language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")])
MAX_TRIES = 4
PLACE = [5, 3, 2, 1]
S = {"type": "string"}


def prompts() -> dict:
    with open(os.path.join(DATA, "foto.json")) as f:
        return json.load(f)


async def ask_with_retry(parts: list, schema: dict, budget: float, waits=(0, 3, 6, 10), smart: bool = True,
                         per_try: float = 30.0) -> dict | None:
    """Gemini with retries while it's busy (free tier: 503/429 spikes), within `budget` seconds."""
    loop = asyncio.get_running_loop()
    end = loop.time() + budget
    for k, wait in enumerate(waits):
        if wait:
            if loop.time() + wait + 3 > end:
                break
            await asyncio.sleep(wait)
        left = end - loop.time()
        if left < 3:
            break
        try:
            return await asyncio.wait_for(ai.generate(parts, schema=schema, smart=smart), timeout=min(left, per_try))
        except (ai.AIUnavailable, asyncio.TimeoutError) as e:
            log.warning("photo AI try %d failed: %s", k + 1, e)
    return None


class PhotoGame(Game):
    kind = "timed"
    default_timer = 0
    photo_mode = "environment"   # which camera the phone opens

    def turn(self):
        return []

    def photo_ok(self, pid: str, r: int) -> str | None:
        """None if this player may send a photo for round r now, else the reason."""
        s = self.s
        if s["phase"] != "play" or r != s["r"] + 1:
            return "Ronde ini sudah selesai."
        sub = s["sub"].get(pid) or {}
        if sub.get("st") in ("ok", "pending", "in"):
            return "Fotomu sudah masuk."
        if sub.get("n", 0) >= MAX_TRIES:
            return "Kesempatan habis untuk ronde ini."
        return None

    def act(self, pid, a, now):
        raise IllegalMove("Ambil foto dengan tombol kamera.")


# =====================================================================================================
# Foto Hunt
# =====================================================================================================

CHECK_SCHEMA = {"type": "object", "properties": {"what": S, "ok": {"type": "boolean"}, "comment": S},
                "required": ["what", "ok", "comment"], "propertyOrdering": ["what", "ok", "comment"]}


class FotoHunt(PhotoGame):
    key, name_id, name_en, icon = "fotohunt", "Foto Hunt", "Photo Hunt", "📸"
    min_players, max_players = 1, 8
    options = [
        LANG_OPT,
        opt("rounds", "Ronde", "Rounds", "select", 5, [ch(n, str(n)) for n in (3, 5, 7)]),
        opt("seconds", "Waktu per ronde", "Time per round", "select", 90, [ch(n, f"{n} dtk", f"{n} s") for n in (45, 60, 90, 120)]),
        opt("where", "Lokasi", "Where", "select", "rumah", [ch("rumah", "Di dalam rumah", "Indoors"), ch("semua", "Di mana saja", "Anywhere")]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        where = options.get("where", "rumah")
        pool = [p for p in prompts()["hunt"] if p["where"] == "semua" or p["where"] == where or where == "semua"]
        rng.shuffle(pool)
        return {"players": players, "items": pool[: int(options.get("rounds", 5))], "r": 0, "phase": "ready", "deadline": 4.0,
                "limit": int(options.get("seconds", 90)), "lang": options.get("lang", "id"), "sub": {}, "order": [],
                "scores": {p["id"]: 0 for p in players}, "turn_no": 0}

    def view(self, pid):
        s = self.s
        it = s["items"][s["r"]]
        show_all = s["phase"] == "reveal" or self.over
        sub = {p: {"st": d.get("st"), "n": d.get("n", 0), "pts": d.get("pts", 0),
                   **({"comment": d.get("comment", ""), "what": d.get("what", "")} if (show_all or p == pid) else {})}
               for p, d in s["sub"].items()}
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "round": s["r"] + 1, "rounds": len(s["items"]),
                "item": it, "sub": sub, "order": s["order"], "scores": s["scores"], "limit": s["limit"], "max_tries": MAX_TRIES}

    def _end_round(self, now):
        s = self.s
        s["phase"], s["deadline"] = "reveal", now + 9
        s["turn_no"] += 1
        return [{"e": "reveal"}]

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "ready":
            s["phase"], s["deadline"], s["sub"], s["order"] = "play", now + s["limit"], {}, []
            s["turn_no"] += 1
            return [{"e": "go"}]
        if s["phase"] == "play":
            if any(d.get("st") == "pending" for d in s["sub"].values()) and now < s["deadline"] + 12:
                return []  # a photo is still being checked: wait for it (a little)
            return self._end_round(now)
        if s["phase"] == "reveal":
            if s["r"] + 1 >= len(s["items"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["phase"], s["deadline"] = "ready", now + 3.5
            s["turn_no"] += 1
            return [{"e": "next"}]
        return []

    def server_input(self, pid, d, now):
        s = self.s
        if d.get("r") != s["r"] + 1:
            return []
        sub = s["sub"].setdefault(pid, {"n": 0})
        if d.get("do") == "photo" and s["phase"] == "play":
            sub["n"] = sub.get("n", 0) + 1
            sub["st"] = "pending"
            s["turn_no"] += 1
            return [{"e": "sent", "who": pid}]
        if d.get("do") == "checked" and sub.get("st") == "pending":
            sub["comment"], sub["what"] = str(d.get("comment", ""))[:200], str(d.get("what", ""))[:80]
            if d.get("ok"):
                sub["st"] = "ok"
                s["order"].append(pid)
                place = len(s["order"])
                pts = PLACE[place - 1] if place <= len(PLACE) else 1
                sub["pts"] = pts
                s["scores"][pid] += pts
                self.bump("photos", pid)
                if place == 1:
                    self.bump("first_photo", pid)
                ev = [{"e": "ok", "who": pid, "place": place, "pts": pts}]
                if len(s["order"]) == len(self.ids()) and s["phase"] == "play":
                    ev += self._end_round(now)
            else:
                sub["st"] = "no"
                ev = [{"e": "no", "who": pid, "left": MAX_TRIES - sub["n"]}]
            s["turn_no"] += 1
            return ev
        return []

    @classmethod
    async def check_photo(cls, game: "FotoHunt", jpeg: bytes) -> dict:
        it = game.s["items"][game.s["r"]]
        lang = game.s["lang"]
        language = "Bahasa Indonesia (santai, lucu, sopan)" if lang == "id" else "English (playful, kind)"
        prompt = (f"Family photo-hunt game. The player had to photograph: \"{it['en']}\" (Indonesian: \"{it['id']}\"). "
                  "Look at the photo. ok = true if it reasonably shows that (be fair and friendly, not strict about details; "
                  "a drawing/print counts only if the task says picture). what = what you see (max 6 words). "
                  f"comment = one short fun sentence in {language} about the photo.")
        # a quick yes/no: the fast models, short tries, so a busy moment still leaves time to retry
        data = await ask_with_retry([prompt, ai.image_part(jpeg, "image/jpeg")], CHECK_SCHEMA, budget=25, smart=False, per_try=12)
        if data is None:
            busy = ("Juri AI lagi sibuk — fotomu diterima tanpa dicek 🙈", "The AI judge is busy — photo accepted unchecked 🙈")
            return {"ok": True, "what": "", "comment": busy[lang == "en"]}
        return {"ok": bool(data.get("ok")), "what": data.get("what", ""), "comment": data.get("comment", "")}


# =====================================================================================================
# Ekspresi Challenge
# =====================================================================================================

RANK_SCHEMA = {"type": "object", "properties": {"ranking": {"type": "array", "items": {
    "type": "object", "properties": {"label": S, "comment": S, "score": {"type": "integer"}},
    "required": ["label", "comment", "score"], "propertyOrdering": ["label", "comment", "score"]}}},
    "required": ["ranking"], "propertyOrdering": ["ranking"]}


class Ekspresi(PhotoGame):
    key, name_id, name_en, icon = "ekspresi", "Ekspresi Challenge", "Face Challenge", "🤪"
    min_players, max_players = 2, 8
    photo_mode = "user"
    options = [
        LANG_OPT,
        opt("rounds", "Ronde", "Rounds", "select", 3, [ch(n, str(n)) for n in (3, 5, 7)]),
        opt("seconds", "Waktu", "Time", "select", 30, [ch(n, f"{n} dtk", f"{n} s") for n in (20, 30, 45, 60)]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        pool = prompts()["expr"][:]
        rng.shuffle(pool)
        return {"players": players, "items": pool[: int(options.get("rounds", 3))], "r": 0, "phase": "ready", "deadline": 4.0,
                "limit": int(options.get("seconds", 30)), "lang": options.get("lang", "id"), "sub": {}, "result": None,
                "scores": {p["id"]: 0 for p in players}, "turn_no": 0, "ai_need": None}

    def view(self, pid):
        s = self.s
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "round": s["r"] + 1, "rounds": len(s["items"]),
                "item": s["items"][s["r"]], "sub": {p: {"st": d.get("st"), "n": d.get("n", 0)} for p, d in s["sub"].items()},
                "result": s["result"] if s["phase"] == "result" else None, "scores": s["scores"], "limit": s["limit"],
                "judge_t0": s.get("judge_t0")}

    def _judge(self, now):
        s = self.s
        ids = [p for p, d in s["sub"].items() if d.get("st") == "in"]
        s["phase"], s["deadline"], s["judge_t0"] = "judging", None, now
        s["turn_no"] += 1
        if not ids:
            return self.provide({"id": ""}, {"ranking": []}, now)
        s["ai_need"] = {"id": f"expr-{s['r']}", "kind": "expr", "r": s["r"] + 1, "ids": ids, "item": s["items"][s["r"]], "lang": s["lang"]}
        return [{"e": "judging"}]

    def tick(self, now):
        s = self.s
        if self.over or s["phase"] == "judging" or now < s["deadline"]:
            return []
        if s["phase"] == "ready":
            s["phase"], s["deadline"], s["sub"], s["result"] = "play", now + s["limit"], {}, None
            s["turn_no"] += 1
            return [{"e": "go"}]
        if s["phase"] == "play":
            return self._judge(now)
        if s["phase"] == "result":
            if s["r"] + 1 >= len(s["items"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["phase"], s["deadline"] = "ready", now + 3.5
            s["turn_no"] += 1
            return [{"e": "next"}]
        return []

    def server_input(self, pid, d, now):
        s = self.s
        if d.get("do") != "photo" or d.get("r") != s["r"] + 1 or s["phase"] != "play":
            return []
        sub = s["sub"].setdefault(pid, {"n": 0})
        sub["n"] = sub.get("n", 0) + 1
        sub["st"] = "in"
        s["turn_no"] += 1
        ev = [{"e": "sent", "who": pid}]
        if all((s["sub"].get(p) or {}).get("st") == "in" for p in self.ids()):
            ev += self._judge(now)
        return ev

    @classmethod
    async def fulfil_room(cls, need, options, room):
        labels, parts = {}, []
        for i, pid in enumerate(need["ids"]):
            jpeg = room.photos.get(f"{need['r']}:{pid}")
            if not jpeg:
                continue
            label = chr(65 + i)
            labels[label] = pid
            parts += [f"Photo {label}:", ai.image_part(jpeg, "image/jpeg")]
        if not parts:
            return {"ranking": []}
        lang = need["lang"]
        language = "Bahasa Indonesia (santai, lucu, sopan)" if lang == "id" else "English (playful, kind)"
        it = need["item"]
        prompt = (f"You are the fun, kind judge of a family selfie game. The challenge was: \"{it['en']}\" "
                  f"(Indonesian: \"{it['id']}\"). Score each photo 0-100 ONLY for how well the person acts out the challenge "
                  "(expression, pose, effort, creativity). Never comment on looks, body, age, skin or clothes. "
                  f"For each: one short funny, encouraging comment in {language}. Labels: {', '.join(labels)}.")
        data = await ask_with_retry([prompt] + parts, RANK_SCHEMA, budget=30)
        if data is None:
            return None
        out = []
        for r in data.get("ranking", []):
            pid = labels.get(str(r.get("label", "")).strip().upper()[:1])
            if pid:
                out.append({"id": pid, "score": max(0, min(100, int(r.get("score", 0)))), "comment": str(r.get("comment", ""))[:200]})
        return {"ranking": out}

    def provide(self, need, result, now):
        s = self.s
        s["ai_need"] = None
        ids = self.ids()
        sent = {p for p, d in s["sub"].items() if d.get("st") == "in"}
        by = {r["id"]: r for r in (result or {}).get("ranking") or []}
        order = sorted(ids, key=lambda p: -(by.get(p, {}).get("score", -1) if p in sent else -2))
        busy = ("Juri AI lagi sibuk (sudah dicoba ±30 dtk) — semua dapat poin sama.",
                "The AI judge is busy (we kept trying for ~30 s) — everyone gets the same points.")[s["lang"] == "en"]
        res, n = [], len(sent)
        sc = {p: by.get(p, {}).get("score", -1) if p in sent else -2 for p in ids}
        for pid in order:
            r = by.get(pid, {})
            rank = 1 + sum(1 for q in ids if sc[q] > sc[pid])  # equal AI scores share the rank (and the points)
            pts = (100 * (n - rank + 1) if result else 50) if pid in sent else 0
            s["scores"][pid] += pts
            if rank == 1 and result and pid in sent:
                self.bump("best_face", pid)
            res.append({"id": pid, "rank": rank, "pts": pts, "score": r.get("score"), "sent": pid in sent,
                        "comment": r.get("comment") or (busy if (pid in sent and not result) else "")})
        s["result"] = res
        s["phase"], s["deadline"] = "result", now + 12
        s["turn_no"] += 1
        return [{"e": "judged"}]
