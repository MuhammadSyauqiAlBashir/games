"""Penalty shootout for 2 players. Each kick the shooter picks left / middle / right and
the keeper picks where to dive, at the same time. Same side = saved, otherwise goal.
Five kicks each, taking turns; then sudden death. Ends early when it's decided."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

CHOOSE = 6.0
RESULT = 4.4
SIDES = ("L", "M", "R")


class Penalty(Game):
    key, name_id, name_en, icon = "penalty", "Adu Penalti", "Penalty shootout", "⚽"
    kind = "timed"
    min_players, max_players = 2, 2
    options = [opt("kicks", "Tendangan per pemain", "Kicks each", "select", 5, [ch(n, str(n)) for n in (3, 5, 7)]),
               opt("seconds", "Waktu memilih", "Time to choose", "select", 6, [ch(n, f"{n} dtk", f"{n} s") for n in (4, 6, 10)])]

    @classmethod
    def setup(cls, players, options, rng, now):
        a, b = players[0]["id"], players[1]["id"]
        return {"players": players, "kicks": int(options.get("kicks", 5)), "limit": float(options.get("seconds", 6)),
                "n": 0, "shooter": a, "keeper": b, "phase": "intro", "deadline": 2.0, "pick": {},
                "history": {a: [], b: []}, "scores": {a: 0, b: 0}, "last": None, "turn_no": 0, "sudden": False}

    def view(self, pid):
        s = self.s
        mine = s["pick"].get(pid) if pid else None
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "shooter": s["shooter"],
                "keeper": s["keeper"], "history": s["history"], "scores": s["scores"], "kicks": s["kicks"],
                "mine": mine, "picked": list(s["pick"]), "limit": s["limit"] if s["phase"] == "choose" else (RESULT if s["phase"] == "result" else 2.0), "last": s["last"] if s["phase"] == "result" else None,
                "sudden": s["sudden"]}

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "choose" or pid not in (s["shooter"], s["keeper"]):
            raise IllegalMove("Wait for the next kick.")
        side = a.get("side")
        if side not in SIDES:
            raise IllegalMove("Choose left, middle or right.")
        if pid in s["pick"]:
            raise IllegalMove("Already chosen.")
        s["pick"][pid] = side
        if len(s["pick"]) == 2:
            s["deadline"] = now
        return [{"e": "picked", "who": pid}]

    def decided(self) -> bool:
        s = self.s
        a, b = self.ids()
        ka, kb = len(s["history"][a]), len(s["history"][b])
        sa, sb = s["scores"][a], s["scores"][b]
        if not s["sudden"]:
            left_a, left_b = s["kicks"] - ka, s["kicks"] - kb
            return sa > sb + left_b or sb > sa + left_a
        return ka == kb and sa != sb

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "intro":
            s["phase"], s["deadline"], s["pick"] = "choose", now + s["limit"], {}
            s["turn_no"] += 1
            return [{"e": "kick"}]
        if s["phase"] == "choose":
            for p in (s["shooter"], s["keeper"]):
                s["pick"].setdefault(p, self.rng.choice(SIDES))
            shot, dive = s["pick"][s["shooter"]], s["pick"][s["keeper"]]
            goal = shot != dive
            s["history"][s["shooter"]].append(goal)
            if goal:
                s["scores"][s["shooter"]] += 1
                self.bump("goals", s["shooter"])
            else:
                self.bump("saves", s["keeper"])
            s["last"] = {"shooter": s["shooter"], "keeper": s["keeper"], "shot": shot, "dive": dive, "goal": goal}
            s["phase"], s["deadline"] = "result", now + RESULT
            s["turn_no"] += 1
            return [{"e": "shot", **s["last"]}]
        if s["phase"] == "result":
            a, b = self.ids()
            if self.decided():
                win = a if s["scores"][a] > s["scores"][b] else b
                self.finish([[win], [a if win == b else b]])
                return [{"e": "end"}]
            if not s["sudden"] and len(s["history"][a]) >= s["kicks"] and len(s["history"][b]) >= s["kicks"]:
                s["sudden"] = True
            s["shooter"], s["keeper"] = s["keeper"], s["shooter"]
            s["phase"], s["deadline"], s["pick"] = "choose", now + s["limit"], {}
            s["turn_no"] += 1
            return [{"e": "kick"}]
        return []
