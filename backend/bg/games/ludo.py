"""Ludo — the owner's rules:
- a 6 is needed to bring a piece out; a 6 gives another roll (three 6s in a row are fine);
- capturing sends the other piece home and gives an extra roll; reaching home gives an extra roll;
- start squares and star squares are safe; no blockades (own pieces may share a square);
- an exact roll is needed to reach home;
- 2–4 players use the 4-colour board (2 players sit opposite), 5–6 players the 6-colour board.

Progress of a piece: -1 = in the yard, 0..50 on the ring (0 = its start square),
51..55 its home column, 56 = home."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

HOME = 56
RING_STEPS = 50  # last ring square before the home column (relative)


def slots_for(n: int) -> tuple[int, list[int]]:
    """(board size, colour slot of each player in seat order)."""
    if n <= 4:
        return 4, {2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3]}[max(2, n)]
    return 6, list(range(n))


class Ludo(Game):
    key, name_id, name_en, icon = "ludo", "Ludo", "Ludo", "🎲"
    min_players, max_players = 2, 6
    santai_ok = True
    default_timer = 30
    options = [
        opt("pieces", "Bidak per pemain", "Pieces each", "select", 4, [ch(4, "4"), ch(3, "3"), ch(2, "2 (cepat)", "2 (quick)")]),
        opt("finish", "Selesai saat", "Game ends", "select", "first",
            [ch("first", "Ada yang menang", "First player home"), ch("all", "Semua peringkat", "All places decided")]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        size, slots = slots_for(len(players))
        k = int(options.get("pieces", 4))
        k = k if k in (2, 3, 4) else 4
        return {
            "players": players, "size": size, "slot": {p["id"]: slots[i] for i, p in enumerate(players)},
            "pieces": {p["id"]: [-1] * k for p in players}, "turn": players[0]["id"], "turn_no": 1,
            "phase": "roll", "dice": None, "moves": [], "finished": [], "last": None,
            "finish_mode": options.get("finish", "first"), "sixes_row": 0,
        }

    # ---- geometry -------------------------------------------------------------------
    def ring(self) -> int:
        return 13 * self.s["size"]

    def abs_pos(self, pid: str, prog: int) -> int | None:
        if prog < 0 or prog > RING_STEPS:
            return None
        return (13 * self.s["slot"][pid] + prog) % self.ring()

    def safe(self, pos: int) -> bool:
        return pos % 13 in (0, 8)

    # ---- rules --------------------------------------------------------------------------
    def options_for(self, pid: str, roll: int) -> list[int]:
        out = []
        for i, prog in enumerate(self.s["pieces"][pid]):
            if prog < 0:
                if roll == 6:
                    out.append(i)
            elif prog < HOME and prog + roll <= HOME:
                out.append(i)
        return out

    def anim_seconds(self, events):
        return 1.7 if any(e.get("e") == "roll" for e in events) else 0.0  # the dice-throw animation on the phones

    def view(self, pid):
        return {**self.base_view(), "size": self.s["size"], "slot": self.s["slot"], "pieces": self.s["pieces"],
                "phase": self.s["phase"], "dice": self.s["dice"], "moves": self.s["moves"] if pid == self.s["turn"] else [],
                "finished": self.s["finished"], "last": self.s["last"]}

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        if a.get("do") == "roll":
            if self.s["phase"] != "roll":
                raise IllegalMove("Move a piece first.")
            return self._roll(pid)
        if a.get("do") == "move":
            if self.s["phase"] != "move":
                raise IllegalMove("Roll the dice first.")
            i = int(a.get("piece", -1))
            if i not in self.s["moves"]:
                raise IllegalMove("That piece can't move.")
            return self._move(pid, i)
        raise IllegalMove("Unknown action.")

    def _roll(self, pid):
        roll = self.rng.randint(1, 6)
        self.s["dice"] = roll
        if roll == 6:
            self.bump("sixes", pid)
        moves = self.options_for(pid, roll)
        ev = [{"e": "roll", "who": pid, "v": roll}]
        if not moves:
            ev.append({"e": "nomove", "who": pid})
            self._end_turn(pid, again=(roll == 6))
        elif len(moves) == 1 or len({self.s["pieces"][pid][i] for i in moves}) == 1:
            ev += self._move(pid, moves[0])  # only one real choice: move it automatically
        else:
            self.s["phase"], self.s["moves"] = "move", moves
            self.s["turn_no"] += 1
        return ev

    def _move(self, pid, i):
        roll = self.s["dice"]
        pieces = self.s["pieces"][pid]
        start = pieces[i]
        new = 0 if start < 0 else start + roll
        pieces[i] = new
        ev = {"e": "move", "who": pid, "piece": i, "from": start, "dest": new, "caps": []}
        bonus = roll == 6
        pos = self.abs_pos(pid, new)
        if pos is not None and not self.safe(pos):
            for other, ops in self.s["pieces"].items():
                if other == pid:
                    continue
                for j, p in enumerate(ops):
                    if p >= 0 and self.abs_pos(other, p) == pos:
                        ops[j] = -1
                        ev["caps"].append([other, j])
            if ev["caps"]:
                bonus = True
                self.bump("captures", pid, len(ev["caps"]))
                for other, _ in ev["caps"]:
                    self.bump("captured", other)
        if new == HOME:
            bonus = True
            ev["home"] = True
        self.s["last"] = [pid, i]
        out = [ev]
        if all(p == HOME for p in pieces):
            self.s["finished"].append(pid)
            out.append({"e": "done", "who": pid, "place": len(self.s["finished"])})
            active = [x for x in self.ids() if x not in self.s["finished"]]
            if self.s["finish_mode"] == "first" or len(active) <= 1:
                self._final(active)
                return out
            bonus = False
        self._end_turn(pid, again=bonus)
        return out

    def _end_turn(self, pid, again: bool):
        self.s["phase"], self.s["moves"] = "roll", []
        if again and pid not in self.s["finished"]:
            self.next_turn(pid)
            return
        ids = self.ids()
        k = ids.index(pid)
        for step in range(1, len(ids) + 1):
            nxt = ids[(k + step) % len(ids)]
            if nxt not in self.s["finished"]:
                self.next_turn(nxt)
                return

    def on_timeout(self, now):
        pid = self.s["turn"]
        if self.s["phase"] == "roll":
            return self._roll(pid)
        # Prefer a capture or getting home, otherwise the piece furthest along.
        best = max(self.s["moves"], key=lambda i: self.s["pieces"][pid][i])
        return self._move(pid, best)

    def _final(self, active):
        quit_ = self.s.get("quit", [])
        placed = [x for x in self.s["finished"] if x not in quit_]
        rest = sorted(active, key=lambda x: -sum(max(0, p) for p in self.s["pieces"][x]))
        self.finish([[x] for x in placed] + [[x] for x in rest] + [[x] for x in quit_],
                    {x: sum(max(0, p) for p in self.s["pieces"][x]) for x in self.ids()})

    def forfeit(self, pid, now):
        self.s["pieces"][pid] = [-1] * len(self.s["pieces"][pid])
        self.s.setdefault("quit", []).append(pid)
        self.s["finished"].append(pid)  # out of play; ranked last by _final
        active = [x for x in self.ids() if x not in self.s["finished"]]
        if len(active) <= 1:
            self._final(active)
        elif self.s["turn"] == pid:
            self._end_turn(pid, again=False)
        return [{"e": "forfeit", "who": pid}]
