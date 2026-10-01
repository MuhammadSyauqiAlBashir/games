"""Ular Tangga (snakes and ladders), 2–6 players. Exact roll to reach 100: if the roll
goes past 100 the piece stays and the turn is lost."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

CLASSIC = {
    "ladders": {1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 99},
    "snakes": {16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78},
}


def random_board(rng, n_ladders: int, n_snakes: int) -> dict:
    used: set[int] = {1, 100}
    ladders, snakes = {}, {}

    def pick(lo, hi):
        for _ in range(500):
            x = rng.randint(lo, hi)
            if x not in used:
                return x
        return None

    for _ in range(n_ladders):
        a = pick(2, 80)
        if a is None:
            break
        b = pick(min(99, a + 10), min(99, a + 40))
        if b is None or b // 10 == a // 10:
            continue
        used |= {a, b}
        ladders[a] = b
    for _ in range(n_snakes):
        a = pick(20, 99)
        if a is None:
            break
        b = pick(max(2, a - 45), max(2, a - 10))
        if b is None or b // 10 == a // 10:
            continue
        used |= {a, b}
        snakes[a] = b
    return {"ladders": ladders, "snakes": snakes}


class UlarTangga(Game):
    key, name_id, name_en, icon = "ulartangga", "Snakes & Ladders", "Snakes & Ladders", "🐍"
    min_players, max_players = 2, 6
    santai_ok = True
    default_timer = 20
    options = [
        opt("board", "Papan", "Board", "select", "classic",
            [ch("classic", "Klasik", "Classic"), ch("random", "Acak", "Random"), ch("easy", "Acak — banyak tangga", "Random — many ladders"),
             ch("hard", "Acak — banyak ular", "Random — many snakes")]),
        opt("six_again", "Angka 6 lempar lagi", "A 6 rolls again", "bool", False),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        kind = options.get("board", "classic")
        if kind == "classic":
            board = {"ladders": dict(CLASSIC["ladders"]), "snakes": dict(CLASSIC["snakes"])}
        else:
            nl, ns = {"random": (8, 9), "easy": (11, 6), "hard": (6, 13)}.get(kind, (8, 9))
            board = random_board(rng, nl, ns)
        return {"players": players, "board": {k: {str(a): b for a, b in v.items()} for k, v in board.items()},
                "pos": {p["id"]: 0 for p in players}, "turn": players[0]["id"], "turn_no": 1, "dice": None,
                "six_again": bool(options.get("six_again")), "last": None}

    def anim_seconds(self, events):
        return 1.7 if any(e.get("e") == "roll" for e in events) else 0.0  # the dice-throw animation on the phones

    def view(self, pid):
        return {**self.base_view(), "board": self.s["board"], "pos": self.s["pos"], "dice": self.s["dice"],
                "last": self.s["last"]}

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        if a.get("do") != "roll":
            raise IllegalMove("Roll the dice.")
        return self._roll(pid)

    def _roll(self, pid):
        roll = self.rng.randint(1, 6)
        self.s["dice"] = roll
        start = self.s["pos"][pid]
        ev = {"e": "roll", "who": pid, "v": roll, "from": start}
        target = start + roll
        if target > 100:
            ev["stuck"] = True
            end = start
        else:
            end = target
            ev["step"] = target
            lad = self.s["board"]["ladders"].get(str(target))
            sn = self.s["board"]["snakes"].get(str(target))
            if lad:
                end = lad
                ev["ladder"] = lad
                self.bump("ladders", pid)
            elif sn:
                end = sn
                ev["snake"] = sn
                self.bump("snakes", pid)
        ev["end"] = end  # not "to": that key marks private events
        self.s["pos"][pid] = end
        self.s["last"] = pid
        if end == 100:
            others = sorted([x for x in self.ids() if x != pid], key=lambda x: -self.s["pos"][x])
            groups = [[pid]]
            for x in others:
                if groups and len(groups) > 1 and self.s["pos"][groups[-1][0]] == self.s["pos"][x]:
                    groups[-1].append(x)
                else:
                    groups.append([x])
            self.finish(groups, dict(self.s["pos"]))
            return [ev]
        ids = self.ids()
        if roll == 6 and self.s["six_again"] and not ev.get("stuck"):
            self.next_turn(pid)
        else:
            self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])
        return [ev]

    def on_timeout(self, now):
        return self._roll(self.s["turn"])
