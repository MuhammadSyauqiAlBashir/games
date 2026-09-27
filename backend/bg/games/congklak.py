"""Congklak — general rules.

Board: 7 small holes each + a store (lumbung). Pits 0..6 belong to player A, 7 is A's
store, 8..14 player B's, 15 B's store. Seeds are sown one per hole going around,
skipping the opponent's store.
- Last seed in your own store: play again.
- Last seed in a hole that already had seeds: pick them all up and keep sowing.
- Last seed in your own empty hole: capture it plus the seeds in the opposite hole
  (if that hole has seeds); the turn ends.
- Last seed in the opponent's empty hole: the turn ends.
When the player to move has no seeds on their side, the other player stores the
seeds left on their own side and the game ends. Most seeds wins."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt, rank_by_score

STORE = {0: 7, 1: 15}


def side_of(i: int) -> int | None:
    if 0 <= i <= 6:
        return 0
    if 8 <= i <= 14:
        return 1
    return None


class Congklak(Game):
    key, name_id, name_en, icon = "congklak", "Congklak", "Congklak", "🐚"
    min_players, max_players = 2, 2
    santai_ok = True
    default_timer = 45
    options = [opt("seeds", "Biji per lubang", "Seeds per hole", "select", 7, [ch(n, str(n)) for n in (4, 5, 6, 7)])]

    @classmethod
    def setup(cls, players, options, rng, now):
        k = int(options.get("seeds", 7))
        k = k if 3 <= k <= 7 else 7
        board = [k] * 16
        board[7] = board[15] = 0
        return {"players": players, "board": board, "turn": players[0]["id"], "turn_no": 1, "last": None,
                "side": {players[0]["id"]: 0, players[1]["id"]: 1}}

    def view(self, pid):
        return {**self.base_view(), "board": self.s["board"], "side": self.s["side"], "last": self.s["last"]}

    def scores(self):
        return {pid: self.s["board"][STORE[sd]] for pid, sd in self.s["side"].items()}

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        hole = int(a.get("hole", -1))
        side = self.s["side"][pid]
        if side_of(hole) != side or self.s["board"][hole] == 0:
            raise IllegalMove("Pick one of your holes that has seeds.")
        return self._sow(pid, hole)

    def _sow(self, pid, hole):
        b = self.s["board"]
        side = self.s["side"][pid]
        my_store, their_store = STORE[side], STORE[1 - side]
        path: list[list[int]] = []  # [[hole, seeds picked up], ...] then drops
        drops: list[int] = []
        seeds, b[hole] = b[hole], 0
        i = hole
        again = False
        capture = None
        for _ in range(2000):  # a very long relay is possible but finite; guard anyway
            while seeds:
                i = (i + 1) % 16
                if i == their_store:
                    continue
                b[i] += 1
                seeds -= 1
                drops.append(i)
            if i == my_store:
                again = True
                break
            if b[i] > 1:  # landed in a hole that had seeds: keep going
                path.append([i, b[i]])
                drops.append(-1)  # marker: pick up here
                seeds, b[i] = b[i], 0
                continue
            if side_of(i) == side:  # own empty hole: capture the opposite hole
                opp = 14 - i
                if b[opp] > 0:
                    capture = [i, opp, b[opp] + 1]
                    b[my_store] += b[opp] + 1
                    b[opp] = b[i] = 0
                    self.bump("captures", pid, capture[2])
            break
        self.s["last"] = hole
        ev = [{"e": "sow", "who": pid, "hole": hole, "drops": drops, "pickups": path, "capture": capture, "again": again}]
        ids = self.ids()
        other = ids[1] if pid == ids[0] else ids[0]
        nxt = pid if again else other
        if not any(b[j] for j in range(16) if side_of(j) == self.s["side"][nxt]):
            # The player to move is empty: the other one stores their remaining seeds.
            holder = other if nxt == pid else pid
            hs = self.s["side"][holder]
            for j in range(16):
                if side_of(j) == hs:
                    b[STORE[hs]] += b[j]
                    b[j] = 0
            sc = self.scores()
            self.s["scores"] = sc
            self.finish(rank_by_score(ids, sc), sc)
            ev.append({"e": "end"})
            return ev
        self.s["scores"] = self.scores()
        self.next_turn(nxt)
        return ev

    def on_timeout(self, now):
        pid = self.s["turn"]
        side = self.s["side"][pid]
        holes = [i for i in range(16) if side_of(i) == side and self.s["board"][i]]
        return self._sow(pid, self.rng.choice(holes))
