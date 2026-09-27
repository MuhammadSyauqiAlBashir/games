"""SOS: place S or O on a grid; completing S-O-S scores a point and earns another turn."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt, rank_by_score

DIRS = [(0, 1), (1, 0), (1, 1), (1, -1)]


class SOS(Game):
    key, name_id, name_en, icon = "sos", "SOS", "SOS", "🆘"
    min_players, max_players = 2, 4
    santai_ok = True
    default_timer = 45
    options = [opt("size", "Ukuran papan", "Board size", "select", 6,
                   [ch(n, f"{n}×{n}") for n in (3, 4, 5, 6, 7, 8, 10, 12, 15)])]

    @classmethod
    def setup(cls, players, options, rng, now):
        n = int(options.get("size", 6))
        n = n if 3 <= n <= 15 else 6
        first = players[0]["id"]
        return {"players": players, "n": n, "grid": [""] * (n * n), "lines": [], "scores": {p["id"]: 0 for p in players},
                "turn": first, "turn_no": 1, "last": None}

    def view(self, pid):
        return {**self.base_view(), "n": self.s["n"], "grid": self.s["grid"], "lines": self.s["lines"],
                "scores": self.s["scores"], "last": self.s["last"]}

    def _new_sos(self, idx: int) -> list[list[int]]:
        n, g = self.s["n"], self.s["grid"]
        r, c = divmod(idx, n)

        def at(rr, cc):
            return g[rr * n + cc] if 0 <= rr < n and 0 <= cc < n else ""

        found = []
        for dr, dc in DIRS:
            if g[idx] == "O":
                if at(r - dr, c - dc) == "S" and at(r + dr, c + dc) == "S":
                    found.append([r - dr, c - dc, r + dr, c + dc])
            else:
                for sgn in (1, -1):
                    if at(r + sgn * dr, c + sgn * dc) == "O" and at(r + 2 * sgn * dr, c + 2 * sgn * dc) == "S":
                        found.append([r, c, r + 2 * sgn * dr, c + 2 * sgn * dc])
        return found

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        idx, letter = int(a.get("i", -1)), a.get("l")
        if letter not in ("S", "O") or not 0 <= idx < len(self.s["grid"]) or self.s["grid"][idx]:
            raise IllegalMove("Pick an empty square and S or O.")
        return self._place(pid, idx, letter)

    def _place(self, pid, idx, letter):
        self.s["grid"][idx] = letter
        lines = self._new_sos(idx)
        for ln in lines:
            self.s["lines"].append(ln + [pid])
        self.s["scores"][pid] += len(lines)
        self.s["last"] = idx
        ev = [{"e": "place", "who": pid, "i": idx, "l": letter, "sos": len(lines)}]
        if lines:
            self.bump("sos", pid, len(lines))
        if all(self.s["grid"]):
            self.finish(rank_by_score(self.ids(), self.s["scores"]))
            return ev
        if lines:
            self.next_turn(pid)
        else:
            ids = self.ids()
            self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])
        return ev

    def on_timeout(self, now):
        pid = self.s["turn"]
        empties = [i for i, v in enumerate(self.s["grid"]) if not v]
        # A scoring move if there is one, otherwise random.
        for i in empties:
            for letter in ("S", "O"):
                self.s["grid"][i] = letter
                hit = self._new_sos(i)
                self.s["grid"][i] = ""
                if hit:
                    return self._place(pid, i, letter)
        return self._place(pid, self.rng.choice(empties), self.rng.choice("SO"))
