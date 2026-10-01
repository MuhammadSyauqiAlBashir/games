"""Gaple (dominoes, double-six set of 28 tiles), 2–4 players.

- Everyone gets 7 tiles. With 4 players there's no boneyard: if you can't play, you pass.
  With 2–3 players the leftover tiles are the boneyard: if you can't play you *nyangkul*
  (draw) one at a time until you can; when it's empty you pass.
- First round: with 4 players the holder of double six (balak 6) starts with it; with 2–3
  players the highest double in anyone's hand starts (or the highest tile if no doubles).
  Later rounds: the previous winner starts with any tile.
- A round ends when someone plays their last tile, or when nobody can move (blocked):
  then the lowest total of dots in hand wins.
- Scoring (room option): a single round, or first to 100 points where the round winner
  scores the dots left in everyone else's hands."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt


def all_tiles() -> list[list[int]]:
    return [[a, b] for a in range(7) for b in range(a, 7)]


def pips(hand) -> int:
    return sum(a + b for a, b in hand)


class Gaple(Game):
    key, name_id, name_en, icon = "gaple", "Dominoes (Gaple)", "Dominoes (Gaple)", "🁫"
    min_players, max_players = 2, 4
    santai_ok = True
    default_timer = 30
    options = [opt("target", "Menang", "Win", "select", 0, [ch(0, "Satu ronde", "Single round"), ch(100, "Sampai 100 poin", "First to 100"),
                                                             ch(150, "Sampai 150 poin", "First to 150")])]

    @classmethod
    def setup(cls, players, options, rng, now):
        s = {"players": players, "scores": {p["id"]: 0 for p in players}, "target": int(options.get("target") or 0),
             "round": 0, "turn_no": 0, "last_winner": None}
        g = cls(s, rng)
        g._deal()
        return s

    def _deal(self):
        s = self.s
        tiles = all_tiles()
        self.rng.shuffle(tiles)
        ids = self.ids()
        hands = {p: [tiles.pop() for _ in range(7)] for p in ids}
        s.update({"hands": hands, "bone": tiles, "line": [], "left_n": 0, "ends": None, "passes": 0, "round": s["round"] + 1,
                  "phase": "play", "round_over": None, "deadline": None, "must": None, "last": None})
        if s["last_winner"] in ids:
            starter, must = s["last_winner"], None
        else:
            doubles = [(t[0], p) for p, h in hands.items() for t in h if t[0] == t[1]]
            if len(ids) == 4 or doubles:
                v, starter = max(doubles) if doubles else (0, ids[0])
                must = [v, v]
            else:
                starter, t = max(((p, t) for p, h in hands.items() for t in h), key=lambda x: sum(x[1]))
                must = t
        s["must"] = must
        self.next_turn(starter)

    # ---- helpers ----------------------------------------------------------------------------
    def fits(self, tile) -> list[str]:
        s = self.s
        if s["must"]:
            return ["L"] if sorted(tile) == sorted(s["must"]) else []
        if not s["ends"]:
            return ["L"]
        left, right = s["ends"]
        out = []
        if left in tile:
            out.append("L")
        if right in tile:
            out.append("R")
        return out

    def view(self, pid):
        s = self.s
        hand = s["hands"].get(pid, []) if pid else []
        return {**self.base_view(), "hand": hand, "can": {i: self.fits(t) for i, t in enumerate(hand) if self.fits(t)}
                if pid == s["turn"] else {}, "counts": {p: len(h) for p, h in s["hands"].items()}, "line": s["line"],
                "ends": s["ends"], "bone": len(s["bone"]), "scores": s["scores"], "target": s["target"],
                "round": s["round"], "phase": s["phase"], "round_over": s["round_over"], "deadline": s["deadline"],
                "last": s["last"], "origin": s.get("left_n", len(s["line"]) // 2)}

    def act(self, pid, a, now):
        s = self.s
        if self.over or pid != s["turn"] or s["phase"] != "play":
            raise IllegalMove("Not your turn.")
        hand = s["hands"][pid]
        do = a.get("do")
        if do == "play":
            i, side = int(a.get("i", -1)), a.get("side", "L")
            if not 0 <= i < len(hand):
                raise IllegalMove("Pick a tile.")
            sides = self.fits(hand[i])
            if not sides:
                raise IllegalMove("That tile doesn't fit.")
            return self._play(pid, i, side if side in sides else sides[0])
        if any(self.fits(t) for t in hand):
            raise IllegalMove("You have a tile that fits.")
        if do == "draw":
            if not s["bone"]:
                raise IllegalMove("The boneyard is empty — pass.")
            hand.append(s["bone"].pop())
            self.bump("nyangkul", pid)
            s["turn_no"] += 1
            return [{"e": "draw", "who": pid}]
        if do == "pass":
            if s["bone"]:
                raise IllegalMove("Draw from the boneyard first (nyangkul).")
            return self._pass(pid)
        raise IllegalMove("Unknown action.")

    def _play(self, pid, i, side):
        s = self.s
        tile = s["hands"][pid].pop(i)
        a, b = tile
        if not s["ends"]:
            s["ends"] = [a, b]
            s["line"].append({"t": [a, b], "who": pid})
        elif side == "L":
            left = s["ends"][0]
            t = [a, b] if b == left else [b, a]  # the right half must match the left end
            s["line"].insert(0, {"t": t, "who": pid})
            s["left_n"] = s.get("left_n", 0) + 1
            s["ends"][0] = t[0]
        else:
            right = s["ends"][1]
            t = [a, b] if a == right else [b, a]
            s["line"].append({"t": t, "who": pid})
            s["ends"][1] = t[1]
        s["must"] = None
        s["passes"] = 0
        s["last"] = {"who": pid, "side": side}
        ev = [{"e": "play", "who": pid, "tile": tile, "side": side}]
        if not s["hands"][pid]:
            return ev + self._round_over(pid, blocked=False)
        self._advance(pid)
        return ev

    def _pass(self, pid):
        s = self.s
        s["passes"] += 1
        self.bump("passes", pid)
        ev = [{"e": "pass", "who": pid}]
        if s["passes"] >= len(self.ids()):
            low = min(self.ids(), key=lambda p: (pips(s["hands"][p]), len(s["hands"][p])))
            return ev + self._round_over(low, blocked=True)
        self._advance(pid)
        return ev

    def _advance(self, pid):
        ids = self.ids()
        self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])

    def _round_over(self, winner, blocked):
        s = self.s
        pts = sum(pips(h) for p, h in s["hands"].items() if p != winner)
        s["scores"][winner] += pts
        s["last_winner"] = winner
        self.bump("rounds_won", winner)
        ev = [{"e": "round", "winner": winner, "points": pts, "blocked": blocked}]
        if not s["target"] or s["scores"][winner] >= s["target"]:
            if s["target"]:
                self.finish([[p] for p in sorted(self.ids(), key=lambda p: -s["scores"][p])])
            else:
                rest = sorted([p for p in self.ids() if p != winner], key=lambda p: pips(s["hands"][p]))
                self.finish([[winner]] + [[p] for p in rest],
                            {p: -pips(s["hands"][p]) for p in self.ids()} | {winner: pts})
            return ev
        s["phase"], s["round_over"] = "round_over", {"winner": winner, "points": pts, "blocked": blocked,
                                                     "hands": s["hands"]}
        s["deadline"], s["turn"] = None, None
        s["turn_no"] += 1
        return ev

    def tick(self, now):
        s = self.s
        if s.get("phase") != "round_over" or self.over:
            return []
        if s["deadline"] is None:
            s["deadline"] = now + 7
            return []
        if now >= s["deadline"]:
            self._deal()
            return [{"e": "newround", "round": s["round"]}]
        return []

    def turn(self):
        return [self.s["turn"]] if self.s.get("turn") and not self.over and self.s["phase"] == "play" else []

    def on_timeout(self, now):
        s = self.s
        pid = s["turn"]
        hand = s["hands"][pid]
        for i, t in enumerate(hand):
            sides = self.fits(t)
            if sides:
                return self._play(pid, i, sides[0])
        if s["bone"]:
            ev = []
            while s["bone"]:
                hand.append(s["bone"].pop())
                self.bump("nyangkul", pid)
                ev.append({"e": "draw", "who": pid})
                sides = self.fits(hand[-1])
                if sides:
                    return ev + self._play(pid, len(hand) - 1, sides[0])
            return ev + self._pass(pid)
        return self._pass(pid)
