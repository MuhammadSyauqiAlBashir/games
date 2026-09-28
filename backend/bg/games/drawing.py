"""Drawing games.

Tebak Gambar (Draw & Guess): players take turns drawing a secret word; everyone else
sees the strokes live and types guesses. Faster guesses score more; the drawer scores
for every correct guess. Letter hints appear as time runs out.

Gambar & Juri AI (Draw & AI judge): everyone draws the same word at the same time (the
canvases stay hidden). When time is up, Gemini looks at all drawings (anonymously) and
ranks how well each one shows the word, with a short comment. Then the gallery is shown.

Strokes: {"k": "b", "c": "#hex", "w": width, "p": [[x, y], ...]} starts a stroke,
{"k": "m", "p": [...]} continues it, {"k": "u"} undo, {"k": "x"} clear.
Coordinates are 0..1000 on a square canvas."""

from __future__ import annotations

import asyncio
import io
import logging

from .. import ai, content, util
from .base import Game, IllegalMove, ch, opt, rank_by_score

log = logging.getLogger("bg.drawing")
MAX_POINTS = 8000


def add_stroke(strokes: list, d: dict) -> dict | None:
    k = d.get("k")
    if k == "b":
        pts = [[max(0, min(1000, int(x))), max(0, min(1000, int(y)))] for x, y in (d.get("p") or [])[:200]]
        color = str(d.get("c", "#222222"))[:9]
        if not (color.startswith("#") and all(c in "0123456789abcdefABCDEF" for c in color[1:])):
            color = "#222222"
        stroke = {"c": color, "w": max(2, min(60, int(d.get("w", 8)))), "p": pts}
        if len(strokes) > 600:
            return None
        strokes.append(stroke)
        return {"k": "b", "c": stroke["c"], "w": stroke["w"], "p": pts}
    if k == "m" and strokes:
        pts = [[max(0, min(1000, int(x))), max(0, min(1000, int(y)))] for x, y in (d.get("p") or [])[:200]]
        if sum(len(s["p"]) for s in strokes) + len(pts) > MAX_POINTS:
            return None
        strokes[-1]["p"] += pts
        return {"k": "m", "p": pts}
    if k == "u" and strokes:
        strokes.pop()
        return {"k": "u"}
    if k == "x":
        strokes.clear()
        return {"k": "x"}
    return None


LEVEL_OPT = opt("level", "Tingkat kata", "Word level", "select", 2,
                [ch(1, "Mudah", "Easy"), ch(2, "Sedang", "Medium"), ch(3, "Sulit", "Hard"), ch(4, "Ahli (idiom & judul)", "Expert (idioms & titles)")])
LANG_OPT = opt("lang", "Bahasa kata", "Word language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")])
THEME_OPT = opt("theme", "Tema pribadi (opsional)", "Personal theme (optional)", "text", "",
                help_id="Mis. nama kucing kami, makanan Bandung, kenangan liburan — AI akan menyelipkan kata dari sini.",
                help_en="E.g. our cats' names, Bandung food, holiday memories — the AI mixes in words from this.")


class DrawGuess(Game):
    key, name_id, name_en, icon = "drawguess", "Tebak Gambar", "Draw & Guess", "🎨"
    kind = "timed"
    content_per_player = True
    min_players, max_players = 2, 6
    options = [
        opt("rounds", "Putaran", "Rounds", "select", 2, [ch(n, str(n)) for n in (1, 2, 3)]),
        opt("seconds", "Waktu menggambar", "Drawing time", "select", 80, [ch(n, f"{n} dtk", f"{n} s") for n in (60, 80, 100, 120)]),
        LANG_OPT, LEVEL_OPT, THEME_OPT,
    ]

    @classmethod
    async def prepare(cls, seats, options, rng):
        n = int(options.get("rounds", 2)) * len(seats) * 3
        return {"words": await content.draw_words(options.get("lang", "id"), int(options.get("level", 2)), n,
                                                  str(options.get("theme", "")), rng)}

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        order = ids * int(options.get("rounds", 2))
        return {"players": players, "order": order, "k": -1, "words": (options.get("__content") or {}).get("words", []),
                "phase": "next", "deadline": 1.5, "limit": int(options.get("seconds", 80)), "choices": [],
                "word": "", "strokes": [], "guessed": {}, "scores": {p: 0 for p in ids}, "turn_no": 0, "drawer": None,
                "started": 0.0, "reveal": []}

    def drawer(self):
        return self.s["drawer"]

    def mask(self, now) -> str:
        s = self.s
        w = s["word"]
        if not w:
            return ""
        frac = (now - s["started"]) / s["limit"] if s["limit"] else 0
        show = set(s["reveal"][: (1 if frac > 0.5 else 0) + (1 if frac > 0.75 else 0) + (1 if frac > 0.9 and len(w) > 6 else 0)])
        return "".join(c if (not c.isalpha() or i in show) else "_" for i, c in enumerate(w))

    def view(self, pid):
        s = self.s
        now = s.get("_now", 0.0)
        is_drawer = pid == s["drawer"]
        done = pid in s["guessed"]
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "drawer": s["drawer"],
                "choices": s["choices"] if is_drawer and s["phase"] == "pick" else [],
                "word": s["word"] if (is_drawer or done or s["phase"] == "reveal") else None,
                "mask": self.mask(now) if s["phase"] == "draw" else "", "hint_times": [s["started"] + s["limit"] * f for f in (0.5, 0.75, 0.9)],
                "strokes": s["strokes"], "guessed": s["guessed"], "scores": s["scores"],
                "turn": s["k"] + 1, "turns": len(s["order"]), "limit": s["limit"], "letters": len(s["word"])}

    def tick(self, now):
        s = self.s
        s["_now"] = now
        if self.over or now < s["deadline"]:
            if s["phase"] == "draw":
                # Resend the view when a hint appears.
                hints = sum(1 for f in (0.5, 0.75, 0.9) if now >= s["started"] + s["limit"] * f)
                if hints != s.get("_hints", 0):
                    s["_hints"] = hints
                    s["turn_no"] += 1
                    return [{"e": "hint"}]
            return []
        if s["phase"] in ("next", "reveal"):
            if s["k"] + 1 >= len(s["order"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["k"] += 1
            s["drawer"] = s["order"][s["k"]]
            s["choices"] = [s["words"].pop() for _ in range(3) if s["words"]] or ["kucing", "rumah", "matahari"]
            s["phase"], s["deadline"] = "pick", now + 12
            s["word"], s["strokes"], s["guessed"] = "", [], {}
            s["turn_no"] += 1
            return [{"e": "pick", "who": s["drawer"]}]
        if s["phase"] == "pick":
            return self._start_draw(self.rng.choice(s["choices"]), now)
        if s["phase"] == "draw":
            return self._reveal(now)
        return []

    def _start_draw(self, word, now):
        s = self.s
        s["word"] = word
        s["phase"], s["started"], s["deadline"] = "draw", now, now + s["limit"]
        s["_hints"] = 0
        letters = [i for i, c in enumerate(word) if c.isalpha()]
        self.rng.shuffle(letters)
        s["reveal"] = letters
        s["turn_no"] += 1
        return [{"e": "draw", "who": s["drawer"]}]

    def _reveal(self, now):
        s = self.s
        s["phase"], s["deadline"] = "reveal", now + 5
        n = len(s["guessed"])
        if n:
            pts = 60 * n + 40
            s["scores"][s["drawer"]] += pts
            self.bump("drawn_guessed", s["drawer"], n)
        s["turn_no"] += 1
        return [{"e": "reveal", "word": s["word"], "guessed": list(s["guessed"])}]

    def act(self, pid, a, now):
        s = self.s
        do = a.get("do")
        if do == "pick":
            if pid != s["drawer"] or s["phase"] != "pick":
                raise IllegalMove("Not your turn to pick.")
            i = int(a.get("i", 0))
            return self._start_draw(s["choices"][max(0, min(i, len(s["choices"]) - 1))], now)
        if do == "guess":
            text = str(a.get("text", "")).strip()[:60]
            if not text:
                raise IllegalMove("Type a guess.")
            if s["phase"] != "draw" or pid == s["drawer"] or pid in s["guessed"]:
                return [{"e": "chat", "who": pid, "text": text}]
            ok, almost = util.close_enough(text, s["word"])
            if ok:
                left = max(0.0, s["deadline"] - now)
                pts = int(100 + 250 * left / s["limit"]) + (50 if not s["guessed"] else 0)
                s["guessed"][pid] = pts
                s["scores"][pid] += pts
                self.bump("guessed", pid)
                if all(p in s["guessed"] for p in self.ids() if p != s["drawer"]):
                    s["deadline"] = now
                s["turn_no"] += 1
                return [{"e": "got", "who": pid, "pts": pts}]
            ev = [{"e": "guess", "who": pid, "text": text}]
            if almost:
                ev.append({"e": "almost", "who": pid, "to": pid, "text": text})
            return ev
        raise IllegalMove("Unknown action.")

    def stroke(self, uid, d, now):
        s = self.s
        if uid != s["drawer"] or s["phase"] != "draw":
            return None
        return add_stroke(s["strokes"], d)


# ------------------------------------------------------------------------------------------------------
def render_png(strokes: list, size: int = 512) -> bytes:
    from PIL import Image, ImageDraw  # noqa: PLC0415
    img = Image.new("RGB", (size, size), "white")
    dr = ImageDraw.Draw(img)
    k = size / 1000
    for s in strokes:
        pts = [(x * k, y * k) for x, y in s["p"]]
        w = max(1, int(s["w"] * k))
        if len(pts) == 1:
            x, y = pts[0]
            dr.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=s["c"])
        else:
            dr.line(pts, fill=s["c"], width=w, joint="curve")
            for x, y in (pts[0], pts[-1]):
                dr.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=s["c"])
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


JUDGE_SCHEMA = {"type": "object", "properties": {"ranking": {"type": "array", "items": {
    "type": "object", "properties": {"label": {"type": "string"}, "comment": {"type": "string"},
                                     "looks_like": {"type": "string"}, "score": {"type": "integer"}},
    "required": ["label", "comment", "looks_like", "score"], "propertyOrdering": ["label", "comment", "looks_like", "score"]}}},
    "required": ["ranking"], "propertyOrdering": ["ranking"]}


class DrawJudge(Game):
    key, name_id, name_en, icon = "drawjudge", "Gambar & Juri AI", "Draw & AI judge", "🤖"
    kind = "timed"
    min_players, max_players = 2, 6
    options = [
        opt("rounds", "Ronde", "Rounds", "select", 3, [ch(n, str(n)) for n in (1, 2, 3, 5)]),
        opt("seconds", "Waktu menggambar", "Drawing time", "select", 60, [ch(n, f"{n} dtk", f"{n} s") for n in (30, 45, 60, 90)]),
        LANG_OPT, LEVEL_OPT, THEME_OPT,
    ]

    @classmethod
    async def prepare(cls, seats, options, rng):
        return {"words": await content.draw_words(options.get("lang", "id"), int(options.get("level", 2)),
                                                  int(options.get("rounds", 3)) + 2, str(options.get("theme", "")), rng)}

    @classmethod
    def setup(cls, players, options, rng, now):
        words = (options.get("__content") or {}).get("words", []) or ["kucing", "rumah", "sepeda"]
        return {"players": players, "words": words, "r": -1, "rounds": int(options.get("rounds", 3)), "word": "",
                "phase": "next", "deadline": 2.0, "limit": int(options.get("seconds", 60)),
                "canvas": {p["id"]: [] for p in players}, "result": None, "scores": {p["id"]: 0 for p in players},
                "lang": options.get("lang", "id"), "turn_no": 0, "ai_need": None, "done": []}

    def view(self, pid):
        s = self.s
        show_all = s["phase"] == "result"
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "word": s["word"],
                "round": s["r"] + 1, "rounds": s["rounds"], "scores": s["scores"], "limit": s["limit"],
                "mine": s["canvas"].get(pid, []) if pid else [], "canvas": s["canvas"] if show_all else {},
                "result": s["result"] if show_all else None, "done": s["done"]}

    def tick(self, now):
        s = self.s
        if self.over or s["phase"] == "judging" or now < s["deadline"]:
            return []
        if s["phase"] in ("next", "result"):
            if s["r"] + 1 >= s["rounds"]:
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["word"] = s["words"][s["r"] % len(s["words"])]
            s["canvas"] = {p: [] for p in self.ids()}
            s["result"], s["done"] = None, []
            s["phase"], s["deadline"] = "draw", now + s["limit"]
            s["turn_no"] += 1
            return [{"e": "draw", "word": s["word"]}]
        if s["phase"] == "draw":
            s["phase"], s["deadline"] = "judging", None
            s["ai_need"] = {"id": f"judge-{s['r']}", "kind": "judge", "word": s["word"], "lang": s["lang"],
                         "canvas": s["canvas"]}
            s["turn_no"] += 1
            return [{"e": "judging"}]
        return []

    def act(self, pid, a, now):
        s = self.s
        if a.get("do") == "done" and s["phase"] == "draw":
            if pid not in s["done"]:
                s["done"].append(pid)
            if all(p in s["done"] for p in self.ids()):
                s["deadline"] = now
            s["turn_no"] += 1
            return [{"e": "done", "who": pid}]
        raise IllegalMove("Keep drawing!")

    def stroke(self, uid, d, now):
        s = self.s
        if s["phase"] != "draw" or uid not in s["canvas"] or uid in s["done"]:
            return None
        ok = add_stroke(s["canvas"][uid], d)
        return {"private": True} if ok else None

    @classmethod
    async def fulfil(cls, need, options):
        word, lang = need["word"], need["lang"]
        labels, parts = {}, []
        for i, (pid, strokes) in enumerate(need["canvas"].items()):
            label = chr(65 + i)
            labels[label] = pid
            if strokes:
                parts.append(f"Drawing {label}:")
                parts.append(ai.image_part(render_png(strokes), "image/png"))
        if not parts:
            return {"ranking": []}
        language = "Bahasa Indonesia (santai, lucu, sopan)" if lang == "id" else "English (playful, kind)"
        prompt = (f"You are the fun, fair judge of a family drawing game. The word to draw was: \"{word}\". "
                  f"Score each drawing 0-100 for how clearly it shows \"{word}\" (recognisability matters more than art "
                  f"skill). For each: a one-sentence comment in {language} and what it looks like (looks_like, same "
                  f"language). Labels: {', '.join(k for k in labels if need['canvas'][labels[k]])}.")
        data = await asyncio.wait_for(ai.generate([prompt] + parts, schema=JUDGE_SCHEMA, smart=True), timeout=45)
        out = []
        for r in data.get("ranking", []):
            pid = labels.get(str(r.get("label", "")).strip().upper()[:1])
            if pid:
                out.append({"id": pid, "score": max(0, min(100, int(r.get("score", 0)))), "comment": r.get("comment", ""),
                            "looks_like": r.get("looks_like", "")})
        return {"ranking": out}

    def provide(self, need, result, now):
        s = self.s
        s["ai_need"] = None
        ids = self.ids()
        n = len(ids)
        ranking = (result or {}).get("ranking") or []
        by = {r["id"]: r for r in ranking}
        order = sorted(ids, key=lambda p: -(by.get(p, {}).get("score", -1) if s["canvas"].get(p) else -1))
        res = []
        for rank, pid in enumerate(order, 1):
            r = by.get(pid, {})
            pts = 100 * (n - rank + 1) if s["canvas"].get(pid) else 0
            if not result:
                pts = 50 if s["canvas"].get(pid) else 0
            s["scores"][pid] += pts
            if rank == 1 and result:
                self.bump("ai_wins", pid)
            res.append({"id": pid, "rank": rank, "pts": pts, "score": r.get("score"),
                        "comment": r.get("comment") or ("AI juri lagi sibuk — semua dapat poin sama." if not result else ""),
                        "looks_like": r.get("looks_like", "")})
        s["result"] = res
        s["phase"], s["deadline"] = "result", now + 12
        s["turn_no"] += 1
        return [{"e": "judged"}]

