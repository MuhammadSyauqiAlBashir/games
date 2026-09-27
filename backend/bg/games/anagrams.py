"""Anagrams (English): everyone gets the same 6 or 7 letters and has the same time to
make as many words (3+ letters) as possible. Longer words score more (3: 100, 4: 400,
5: 1200, 6: 2000, 7: 3000). Words are checked against the ENABLE dictionary. At the end
of each round everyone's words are shown, plus the common words nobody found."""

from __future__ import annotations

from .. import words as W
from .base import Game, IllegalMove, ch, opt, rank_by_score

REVEAL = 12.0
INTRO = 3.0


class Anagrams(Game):
    key, name_id, name_en, icon = "anagrams", "Anagram (Inggris)", "Anagrams", "🔤"
    kind = "timed"
    min_players, max_players = 2, 6
    options = [
        opt("letters", "Jumlah huruf", "Letters", "select", 6, [ch(6, "6"), ch(7, "7")]),
        opt("seconds", "Waktu per ronde", "Time per round", "select", 90, [ch(n, f"{n} dtk", f"{n} s") for n in (60, 90, 120)]),
        opt("rounds", "Ronde", "Rounds", "select", 3, [ch(n, str(n)) for n in (1, 2, 3, 5)]),
        opt("level", "Tingkat kata", "Word level", "select", 2, [ch(1, "Mudah", "Easy"), ch(2, "Sedang", "Medium"),
                                                                 ch(3, "Sulit", "Hard"), ch(4, "Ahli", "Expert")]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        n = int(options.get("letters", 6))
        rounds = []
        for _ in range(int(options.get("rounds", 3))):
            letters, seed, valid = W.pick_letters(n, int(options.get("level", 2)), rng)
            rounds.append({"letters": letters, "seed": seed, "valid": valid})
        return {"players": players, "rounds": rounds, "r": 0, "phase": "intro", "deadline": INTRO,
                "limit": int(options.get("seconds", 90)), "found": {p["id"]: [] for p in players},
                "all_found": [], "scores": {p["id"]: 0 for p in players}, "turn_no": 0}

    def view(self, pid):
        s = self.s
        rd = s["rounds"][s["r"]]
        v = {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "letters": rd["letters"],
             "round": s["r"] + 1, "rounds": len(s["rounds"]), "scores": s["scores"],
             "counts": {p: len(w) for p, w in s["found"].items()}, "mine": s["found"].get(pid, []) if pid else [],
             "limit": s["limit"]}
        if s["phase"] == "reveal":
            wd = W.words()
            got = {w for ws in s["found"].values() for w in ws}
            v.update({"found": s["found"], "seed": rd["seed"],
                      "missed": [w for w in rd["valid"] if w not in got and wd.get(w, 0) >= 2.8][:40]})
        return v

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "intro":
            s["phase"], s["deadline"] = "play", now + s["limit"]
            s["turn_no"] += 1
            return [{"e": "go"}]
        if s["phase"] == "play":
            s["phase"], s["deadline"] = "reveal", now + REVEAL
            s["turn_no"] += 1
            s["all_found"].append(dict(s["found"]))
            best = max(((len(w), p) for p, ws in s["found"].items() for w in ws), default=None)
            if best:
                st = s.setdefault("stats", {}).setdefault("longest", {})
                for p, ws in s["found"].items():
                    if ws:
                        st[p] = max(st.get(p, 0), max(len(w) for w in ws))
            return [{"e": "times_up"}]
        if s["phase"] == "reveal":
            if s["r"] + 1 >= len(s["rounds"]):
                self.finish(rank_by_score(self.ids(), s["scores"]))
                return [{"e": "end"}]
            s["r"] += 1
            s["found"] = {p: [] for p in self.ids()}
            s["phase"], s["deadline"] = "intro", now + INTRO
            s["turn_no"] += 1
            return [{"e": "round", "r": s["r"]}]
        return []

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play":
            raise IllegalMove("The round hasn't started.")
        w = "".join(ch_ for ch_ in str(a.get("w", "")).lower() if ch_.isalpha())
        rd = s["rounds"][s["r"]]
        if len(w) < 3:
            raise IllegalMove("At least 3 letters.")
        if w in s["found"][pid]:
            raise IllegalMove("You already have that word.")
        if w not in rd["valid"]:
            letters = list(rd["letters"])
            for c in w:
                if c in letters:
                    letters.remove(c)
                else:
                    raise IllegalMove("Use only the letters shown.")
            raise IllegalMove(f"“{w}” isn't in the dictionary.")
        s["found"][pid].append(w)
        pts = W.points(w)
        s["scores"][pid] += pts
        self.bump("words", pid)
        return [{"e": "word", "who": pid, "len": len(w), "pts": pts, "to": pid, "w": w}]
