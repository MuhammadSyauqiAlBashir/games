"""Question games that share one flow: Trivia (multiple choice), Matematika (typed numbers)
and Tebak Gambar/Rebus (typed words).

intro (level banner) → question (timer) → reveal → next question … → final scores.
Faster correct answers score more; difficulty phases multiply the points
(Easy ×1, Medium ×2, Hard ×3, Expert ×5). Any player can report (⚑) a bad question:
it's voided for everyone in this game and removed from the bank."""

from __future__ import annotations

from .. import content, mathgen, util
from .base import Game, IllegalMove, ch, opt, rank_by_score

MULT = {1: 1, 2: 2, 3: 3, 4: 5}
LEVEL_NAMES = {1: ("Mudah", "Easy"), 2: ("Sedang", "Medium"), 3: ("Sulit", "Hard"), 4: ("Ahli", "Expert")}
INTRO = 3.0
REVEAL = 5.0


def ramp(n: int, levels: int = 4) -> list[int]:
    """Split n questions into rising difficulty phases."""
    out = []
    for i in range(n):
        out.append(1 + min(levels - 1, i * levels // n))
    return out


class QuizBase(Game):
    kind = "timed"
    min_players, max_players = 2, 6
    santai_ok = False
    typed = False

    @classmethod
    def base_state(cls, players, options, questions):
        return {"players": players, "qs": questions, "i": -1, "phase": "intro", "deadline": INTRO, "answers": {},
                "scores": {p["id"]: 0 for p in players}, "void": [], "limit": int(options.get("seconds", 15)),
                "lang": options.get("lang", "id"), "turn_no": 0, "history": [], "streak": {p["id"]: 0 for p in players},
                "started_q": 0.0, "level_shown": 0}

    def view(self, pid):
        s = self.s
        i = s["i"]
        cur = s["qs"][i] if 0 <= i < len(s["qs"]) else None
        public = None
        if cur:
            public = self.public_question(cur, s["phase"] != "question")
        mine = s["answers"].get(pid) if pid else None
        others = {p: {"done": True, "ok": a.get("ok")} if s["phase"] == "reveal" else {"done": bool(a.get("final"))}
                  for p, a in s["answers"].items()}
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "i": i, "n": len(s["qs"]),
                "q": public, "mine": mine, "answered": others, "scores": s["scores"], "void": s["void"],
                "level": cur["level"] if cur else (s["qs"][0]["level"] if s["qs"] else 1), "limit": s["limit"],
                "lang": s["lang"], "last": s["history"][-1] if s["history"] and s["phase"] == "reveal" else None,
                "hint": self.hint(cur) if cur and s["phase"] == "question" else None}

    def public_question(self, cur, reveal) -> dict:
        raise NotImplementedError

    def hint(self, cur):
        return None

    def tick(self, now):
        s = self.s
        if self.over or s["deadline"] is None or now < s["deadline"]:
            return []
        if s["phase"] == "intro":
            return self._next_question(now)
        if s["phase"] == "question":
            return self._reveal(now)
        if s["phase"] == "reveal":
            if s["i"] + 1 >= len(s["qs"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            nxt = s["qs"][s["i"] + 1]
            if nxt["level"] != s["qs"][s["i"]]["level"]:
                s["phase"], s["deadline"] = "intro", now + INTRO
                s["turn_no"] += 1
                return [{"e": "level", "level": nxt["level"]}]
            return self._next_question(now)
        return []

    def _next_question(self, now):
        s = self.s
        s["i"] += 1
        s["phase"] = "question"
        s["answers"] = {}
        s["started_q"] = now
        s["deadline"] = now + s["limit"]
        s["turn_no"] += 1
        return [{"e": "question", "i": s["i"]}]

    def _reveal(self, now):
        s = self.s
        s["phase"] = "reveal"
        s["deadline"] = now + REVEAL
        cur = s["qs"][s["i"]]
        right = [p for p, a in s["answers"].items() if a.get("ok")]
        for p in self.ids():
            if p in right:
                s["streak"][p] += 1
                st = s.setdefault("stats", {}).setdefault("best_streak", {})
                st[p] = max(st.get(p, 0), s["streak"][p])
            else:
                s["streak"][p] = 0
        s["history"].append({"i": s["i"], "right": right, "points": {p: a.get("pts", 0) for p, a in s["answers"].items()},
                             "answer": self.answer_text(cur)})
        s["turn_no"] += 1
        return [{"e": "reveal", "i": s["i"], "right": right}]

    def answer_text(self, cur) -> str:
        return str(cur.get("answer", ""))

    def score_for(self, cur, now) -> int:
        s = self.s
        left = max(0.0, s["deadline"] - now)
        return int(round(100 * MULT.get(cur["level"], 1) * (0.5 + 0.5 * left / s["limit"])))

    def _all_done(self):
        return all(self.s["answers"].get(p, {}).get("final") for p in self.ids())

    def act(self, pid, a, now):
        s = self.s
        if self.over:
            raise IllegalMove("The game is over.")
        if a.get("do") == "report":
            return self._report(pid, a, now)
        if s["phase"] != "question":
            raise IllegalMove("Wait for the next question.")
        cur = s["qs"][s["i"]]
        mine = s["answers"].setdefault(pid, {"tries": 0})
        if mine.get("final"):
            raise IllegalMove("You've already answered.")
        ev = self.answer(pid, cur, mine, a, now)
        if self._all_done():
            s["deadline"] = now
        return ev

    def answer(self, pid, cur, mine, a, now) -> list:
        raise NotImplementedError

    def correct(self, pid, cur, mine, now):
        s = self.s
        pts = self.score_for(cur, now)
        first = not any(x.get("ok") for p, x in s["answers"].items() if p != pid)
        if first and len(self.ids()) > 2:
            pts += 20 * MULT.get(cur["level"], 1)
        mine.update({"ok": True, "final": True, "pts": pts, "t": round(now - s["started_q"], 2)})
        s["scores"][pid] += pts
        self.bump("correct", pid)
        fast = s.setdefault("stats", {}).setdefault("fastest", {})
        fast[pid] = min(fast.get(pid, 999), mine["t"])
        return [{"e": "right", "who": pid, "first": first}]

    def _report(self, pid, a, now):
        s = self.s
        i = int(a.get("i", s["i"]))
        if not 0 <= i <= s["i"] or i in s["void"]:
            raise IllegalMove("Already reported.")
        cur = s["qs"][i]
        s["void"].append(i)
        # Take back the points of that question.
        hist = next((h for h in s["history"] if h["i"] == i), None)
        if hist:
            for p, pts in hist["points"].items():
                s["scores"][p] -= pts
        elif i == s["i"]:
            for p, x in s["answers"].items():
                s["scores"][p] -= x.get("pts", 0)
                x["pts"] = 0
        s["turn_no"] += 1
        reason = str(a.get("reason", "")).strip()[:300]
        qtext = cur.get("q") or cur.get("id") or cur.get("answer")
        return [{"e": "report", "qid": cur.get("qid", ""), "who": pid, "i": i,
                 "reason": f"{reason} | Q: {qtext} | A: {self.answer_text(cur)}"}]


# ---------------------------------------------------------------------------------------------------
class Trivia(QuizBase):
    key, name_id, name_en, icon = "trivia", "Trivia", "Trivia", "🧠"
    options = [
        opt("topics", "Topik", "Topics", "multi", ["general", "indonesia", "flags"],
            [ch(k, v[0], v[1]) for k, v in content.TOPICS.items()]),
        opt("lang", "Bahasa soal", "Question language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")]),
        opt("count", "Jumlah soal", "Questions", "select", 12, [ch(n, str(n)) for n in (8, 12, 16, 20)]),
        opt("seconds", "Waktu per soal", "Time per question", "select", 15, [ch(n, f"{n} dtk", f"{n} s") for n in (10, 15, 20, 30)]),
        opt("difficulty", "Tingkat", "Difficulty", "select", "ramp",
            [ch("ramp", "Makin sulit (Mudah → Ahli)", "Gets harder (Easy → Expert)"), ch(1, "Mudah", "Easy"),
             ch(2, "Sedang", "Medium"), ch(3, "Sulit", "Hard"), ch(4, "Ahli", "Expert")]),
    ]

    @classmethod
    async def prepare(cls, seats, options, rng):
        n = int(options.get("count", 12))
        d = options.get("difficulty", "ramp")
        plan = ramp(n) if d == "ramp" else [int(d)] * n
        return {"qs": await content.trivia_questions(options.get("topics") or ["general"], options.get("lang", "id"), plan, rng)}

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.base_state(players, options, (options.get("__content") or {}).get("qs", []))

    def public_question(self, cur, reveal):
        d = {"q": cur["q"], "choices": cur["choices"], "flag": cur.get("flag"), "topic": cur.get("topic"),
             "level": cur["level"], "source": cur.get("source")}
        if reveal:
            d.update({"answer": cur["answer"], "explain": cur.get("explain", "")})
        return d

    def answer_text(self, cur):
        return cur["choices"][cur["answer"]]

    def answer(self, pid, cur, mine, a, now):
        c = int(a.get("c", -1))
        if not 0 <= c < len(cur["choices"]):
            raise IllegalMove("Pick an answer.")
        mine["c"] = c
        if c == cur["answer"]:
            return self.correct(pid, cur, mine, now)
        mine.update({"ok": False, "final": True, "pts": 0})
        return [{"e": "answered", "who": pid}]


# ---------------------------------------------------------------------------------------------------
class Matematika(QuizBase):
    key, name_id, name_en, icon = "math", "Matematika", "Math race", "➗"
    typed = True
    options = [
        opt("level", "Tingkat", "Level", "select", "ramp",
            [ch("ramp", "Campur, makin sulit", "Mixed, gets harder"), ch(1, "SD"), ch(2, "SMP"), ch(3, "SMA")]),
        opt("types", "Jenis soal", "Question types", "multi", ["arith", "sequence", "story", "logic"],
            [ch("arith", "Hitungan cepat", "Quick sums"), ch("sequence", "Deret angka", "Number sequences"),
             ch("story", "Soal cerita", "Word problems"), ch("logic", "Logika", "Logic")]),
        opt("lang", "Bahasa soal", "Question language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")]),
        opt("count", "Jumlah soal", "Questions", "select", 10, [ch(n, str(n)) for n in (6, 10, 15, 20)]),
        opt("seconds", "Waktu per soal", "Time per question", "select", 30, [ch(n, f"{n} dtk", f"{n} s") for n in (15, 20, 30, 45, 60)]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        n = int(options.get("count", 10))
        lv = options.get("level", "ramp")
        levels = ramp(n, 3) if lv == "ramp" else [int(lv)] * n
        qs = mathgen.make(n, levels, options.get("types") or [], rng)
        return cls.base_state(players, options, qs)

    def public_question(self, cur, reveal):
        lang = self.s["lang"]
        d = {"q": cur["id"] if lang == "id" else cur["en"], "level": cur["level"], "type": cur["type"], "unit": cur["unit"]}
        if reveal:
            d["answer"] = self.answer_text(cur)
        return d

    def answer_text(self, cur):
        ans = cur["answer"]
        if "|" in ans:
            return ans.split("|")[0 if self.s["lang"] == "id" else 1]
        return ans

    def answer(self, pid, cur, mine, a, now):
        text = str(a.get("text", "")).strip()[:40]
        if not text:
            raise IllegalMove("Type an answer.")
        mine["tries"] += 1
        ans = cur["answer"]
        if "|" in ans:
            ok = util.norm(text) in [util.norm(x) for x in ans.split("|")]
        else:
            digits = text.replace(".", "").replace(",", "").replace(" ", "").replace("Rp", "").replace("rp", "")
            ok = digits.lstrip("+") == ans or (digits.startswith("-") and digits == ans)
        if ok:
            return self.correct(pid, cur, mine, now)
        mine["last_wrong"] = text
        if mine["tries"] >= 3:
            mine.update({"ok": False, "final": True, "pts": 0})
        return [{"e": "wrong", "who": pid, "to": pid, "tries": mine["tries"]}]


# ---------------------------------------------------------------------------------------------------
class Rebus(QuizBase):
    key, name_id, name_en, icon = "rebus", "Tebak Gambar Kata", "Rebus puzzles", "🧩"
    typed = True
    options = [
        opt("lang", "Bahasa", "Language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")]),
        opt("count", "Jumlah teka-teki", "Puzzles", "select", 10, [ch(n, str(n)) for n in (6, 10, 15)]),
        opt("seconds", "Waktu per teka-teki", "Time per puzzle", "select", 45, [ch(n, f"{n} dtk", f"{n} s") for n in (30, 45, 60, 90)]),
        opt("ai", "Tambah teka-teki baru dari AI", "Add new AI puzzles", "bool", True),
    ]

    @classmethod
    async def prepare(cls, seats, options, rng):
        n = int(options.get("count", 10))
        return {"qs": await content.rebus_puzzles(options.get("lang", "id"), n, bool(options.get("ai", True)), rng)}

    @classmethod
    def setup(cls, players, options, rng, now):
        qs = (options.get("__content") or {}).get("qs", [])
        for x in qs:
            x["level"] = max(1, min(4, int(x.get("level", 2))))
        return cls.base_state(players, options, qs)

    def public_question(self, cur, reveal):
        d = {"elements": cur["elements"], "level": cur["level"], "words": [len(w) for w in cur["answer"].split()],
             "source": cur.get("source")}
        if reveal:
            d.update({"answer": cur["answer"], "explain": cur.get("explain") or cur.get("hint", "")})
        return d

    def view(self, pid):
        v = super().view(pid)
        s = self.s
        i = s["i"]
        if 0 <= i < len(s["qs"]) and s["phase"] == "question":
            cur = s["qs"][i]
            v["hints"] = {"hint": cur.get("hint", ""), "at": [s["started_q"] + s["limit"] * 0.4, s["started_q"] + s["limit"] * 0.7],
                          "letters": " ".join(w[0].upper() + "·" * (len(w) - 1) for w in cur["answer"].split())}
        return v

    def answer(self, pid, cur, mine, a, now):
        text = str(a.get("text", "")).strip()[:80]
        if not text:
            raise IllegalMove("Type an answer.")
        mine["tries"] += 1
        ok, almost = util.close_enough(text, cur["answer"])
        if not ok:
            for alt in cur.get("alts") or []:
                ok, al2 = util.close_enough(text, alt)
                almost = almost or al2
                if ok:
                    break
        if ok:
            return self.correct(pid, cur, mine, now)
        return [{"e": "wrong", "who": pid, "to": pid, "almost": almost, "text": text}]
