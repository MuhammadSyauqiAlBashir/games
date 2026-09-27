"""Connect Four: drop discs, four in a row wins."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

SIZES = {"7x6": (7, 6), "8x7": (8, 7), "9x7": (9, 7), "10x8": (10, 8)}


class Connect4(Game):
    key, name_id, name_en, icon = "connect4", "Connect 4", "Connect 4", "🔴"
    min_players, max_players = 2, 2
    santai_ok = True
    default_timer = 30
    options = [opt("board", "Papan", "Board", "select", "7x6", [ch(k, k.replace("x", "×")) for k in SIZES])]

    @classmethod
    def setup(cls, players, options, rng, now):
        w, h = SIZES.get(options.get("board", "7x6"), (7, 6))
        return {"players": players, "w": w, "h": h, "grid": [""] * (w * h), "turn": players[0]["id"], "turn_no": 1,
                "win": None, "last": None}

    def view(self, pid):
        return {**self.base_view(), "w": self.s["w"], "h": self.s["h"], "grid": self.s["grid"], "win": self.s["win"],
                "last": self.s["last"]}

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        return self._drop(pid, int(a.get("col", -1)))

    def _drop(self, pid, col):
        w, h, g = self.s["w"], self.s["h"], self.s["grid"]
        if not 0 <= col < w or g[col]:
            raise IllegalMove("That column is full.")
        row = max(r for r in range(h) if not g[r * w + col])
        idx = row * w + col
        g[idx] = pid
        self.s["last"] = idx
        ev = [{"e": "drop", "who": pid, "col": col, "row": row}]
        ids = self.ids()
        win = self._line(idx)
        if win:
            self.s["win"] = win
            self.finish([[pid], [x for x in ids if x != pid]])
        elif all(g):
            self.finish([ids])
        else:
            self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])
        return ev

    def _line(self, idx):
        # line_at assumes a square board; check directly on the w×h grid.
        w, h, g = self.s["w"], self.s["h"], self.s["grid"]
        who = g[idx]
        r, c = divmod(idx, w)
        for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
            cells = [idx]
            for sgn in (1, -1):
                rr, cc = r + sgn * dr, c + sgn * dc
                while 0 <= rr < h and 0 <= cc < w and g[rr * w + cc] == who:
                    cells.append(rr * w + cc)
                    rr, cc = rr + sgn * dr, cc + sgn * dc
            if len(cells) >= 4:
                return sorted(cells)
        return None

    def on_timeout(self, now):
        cols = [c for c in range(self.s["w"]) if not self.s["grid"][c]]
        return self._drop(self.s["turn"], self.rng.choice(cols))

