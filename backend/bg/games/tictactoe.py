"""Tic-tac-toe on any board size: get K in a row (3×3/3 up to 15×15/5, i.e. gomoku), 2–4 players."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

SYMBOLS = ["X", "O", "△", "□"]


def line_at(grid: list, n: int, idx: int, k: int) -> list[int] | None:
    who = grid[idx]
    r, c = divmod(idx, n)
    for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
        cells = [idx]
        for sgn in (1, -1):
            rr, cc = r + sgn * dr, c + sgn * dc
            while 0 <= rr < n and 0 <= cc < n and grid[rr * n + cc] == who:
                cells.append(rr * n + cc)
                rr, cc = rr + sgn * dr, cc + sgn * dc
        if len(cells) >= k:
            return sorted(cells)
    return None


class TicTacToe(Game):
    key, name_id, name_en, icon = "tictactoe", "Tic-tac-toe", "Tic-tac-toe", "❌"
    min_players, max_players = 2, 4
    santai_ok = True
    default_timer = 30
    options = [
        opt("size", "Ukuran papan", "Board size", "select", 3, [ch(n, f"{n}×{n}") for n in (3, 4, 5, 6, 7, 8, 10, 12, 15)]),
        opt("k", "Menang jika berderet", "Win with in a row", "select", 0,
            [ch(0, "Otomatis", "Automatic"), ch(3, "3"), ch(4, "4"), ch(5, "5"), ch(6, "6")]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        n = int(options.get("size", 3))
        n = n if 3 <= n <= 15 else 3
        k = int(options.get("k", 0) or 0)
        if not k:
            k = 3 if n <= 4 else 4 if n <= 6 else 5
        k = max(3, min(k, n))
        return {"players": players, "n": n, "k": k, "grid": [""] * (n * n), "turn": players[0]["id"], "turn_no": 1,
                "sym": {p["id"]: SYMBOLS[i] for i, p in enumerate(players)}, "win": None, "last": None}

    def view(self, pid):
        return {**self.base_view(), "n": self.s["n"], "k": self.s["k"], "grid": self.s["grid"], "sym": self.s["sym"],
                "win": self.s["win"], "last": self.s["last"]}

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        idx = int(a.get("i", -1))
        if not 0 <= idx < len(self.s["grid"]) or self.s["grid"][idx]:
            raise IllegalMove("That square is taken.")
        return self._place(pid, idx)

    def _place(self, pid, idx):
        g = self.s["grid"]
        g[idx] = pid
        self.s["last"] = idx
        ev = [{"e": "place", "who": pid, "i": idx}]
        win = line_at(g, self.s["n"], idx, self.s["k"])
        ids = self.ids()
        if win:
            self.s["win"] = win
            self.finish([[pid], [x for x in ids if x != pid]])
            ev.append({"e": "win", "who": pid})
        elif all(g):
            self.finish([ids])
            ev.append({"e": "draw"})
        else:
            self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])
        return ev

    def on_timeout(self, now):
        empties = [i for i, v in enumerate(self.s["grid"]) if not v]
        return self._place(self.s["turn"], self.rng.choice(empties))
