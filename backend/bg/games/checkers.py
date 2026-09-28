"""Checkers — international rules (10×10).

Men move one step diagonally forward and capture forwards and backwards. Kings fly
(any distance). Capturing is compulsory and you must take the most pieces possible;
captured pieces are removed after the move and can't be jumped twice. A man is
crowned only if the move *ends* on the far row. No pieces or no moves = you lose.
Draw after 50 moves in a row with no capture and no man moved."""

from __future__ import annotations

from .base import Game, IllegalMove

N = 10
DIAG = ((-1, -1), (-1, 1), (1, -1), (1, 1))


def on(r, c):
    return 0 <= r < N and 0 <= c < N


class Checkers(Game):
    key, name_id, name_en, icon = "checkers", "Dam (Checkers)", "Checkers", "⚫"
    min_players, max_players = 2, 2
    santai_ok = True
    default_timer = 60
    options = []

    @classmethod
    def setup(cls, players, options, rng, now):
        b = [""] * (N * N)
        for r in range(N):
            for c in range(N):
                if (r + c) % 2 == 1:
                    if r < 4:
                        b[r * N + c] = "b"
                    elif r > 5:
                        b[r * N + c] = "w"
        s = {"players": players, "board": b, "turn": players[0]["id"], "turn_no": 1, "quiet": 0, "last": None,
             "color": {players[0]["id"]: "w", players[1]["id"]: "b"}}
        return s

    # ---- move generation -----------------------------------------------------------
    def _mine(self, piece, color):
        return piece and piece.lower() == color

    def _captures_from(self, b, idx, color, king, captured):
        """All capture continuations from idx: list of (path, captured) with path excluding idx."""
        r, c = divmod(idx, N)
        results = []
        for dr, dc in DIAG:
            if king:
                rr, cc = r + dr, c + dc
                while on(rr, cc) and not b[rr * N + cc]:
                    rr, cc = rr + dr, cc + dc
                if not on(rr, cc):
                    continue
                victim = rr * N + cc
                if victim in captured or not b[victim] or self._mine(b[victim], color):
                    continue
                lr, lc = rr + dr, cc + dc
                while on(lr, lc) and not b[lr * N + lc]:
                    land = lr * N + lc
                    results.append(([land], captured + [victim]))
                    lr, lc = lr + dr, lc + dc
            else:
                rr, cc, lr, lc = r + dr, c + dc, r + 2 * dr, c + 2 * dc
                if not on(lr, lc):
                    continue
                victim, land = rr * N + cc, lr * N + lc
                if victim in captured or not b[victim] or self._mine(b[victim], color) or b[land]:
                    continue
                results.append(([land], captured + [victim]))
        out = []
        for path, caps in results:
            land = path[-1]
            # Move the piece temporarily (captured pieces stay on the board until the end).
            piece = b[idx]
            b[idx], b[land] = "", piece
            more = self._captures_from(b, land, color, king, caps)
            b[land], b[idx] = "", piece
            if more:
                out += [(path + p2, c2) for p2, c2 in more]
            else:
                out.append((path, caps))
        return out

    def legal(self, pid=None) -> list[dict]:
        pid = pid or self.s["turn"]
        color = self.s["color"][pid]
        b = list(self.s["board"])
        caps = []
        for i, p in enumerate(b):
            if self._mine(p, color):
                for path, cs in self._captures_from(b, i, color, p.isupper(), []):
                    caps.append({"path": [i] + path, "caps": cs})
        if caps:
            best = max(len(m["caps"]) for m in caps)
            return [m for m in caps if len(m["caps"]) == best]
        moves = []
        fwd = -1 if color == "w" else 1
        for i, p in enumerate(b):
            if not self._mine(p, color):
                continue
            r, c = divmod(i, N)
            if p.isupper():
                for dr, dc in DIAG:
                    rr, cc = r + dr, c + dc
                    while on(rr, cc) and not b[rr * N + cc]:
                        moves.append({"path": [i, rr * N + cc], "caps": []})
                        rr, cc = rr + dr, cc + dc
            else:
                for dc in (-1, 1):
                    rr, cc = r + fwd, c + dc
                    if on(rr, cc) and not b[rr * N + cc]:
                        moves.append({"path": [i, rr * N + cc], "caps": []})
        return moves

    def view(self, pid):
        v = {**self.base_view(), "board": self.s["board"], "color": self.s["color"], "last": self.s["last"]}
        if pid and pid == self.s.get("turn") and not self.over:
            v["moves"] = self.legal(pid)
        return v

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        path = [int(x) for x in a.get("path", [])]
        move = next((m for m in self.legal(pid) if m["path"] == path), None)
        if not move:
            raise IllegalMove("That move isn't allowed (captures are compulsory — take the most pieces).")
        return self._apply(pid, move)

    def _apply(self, pid, move):
        b = self.s["board"]
        start, end = move["path"][0], move["path"][-1]
        piece = b[start]
        b[start] = ""
        for v in move["caps"]:
            b[v] = ""
        crowned = False
        row = end // N
        if piece == "w" and row == 0:
            piece, crowned = "W", True
        elif piece == "b" and row == N - 1:
            piece, crowned = "B", True
        b[end] = piece
        self.s["last"] = move["path"]
        if move["caps"]:
            self.bump("captures", pid, len(move["caps"]))
        if crowned:
            self.bump("kings", pid)
        self.s["quiet"] = 0 if (move["caps"] or piece in ("w", "b") or crowned) else self.s["quiet"] + 1
        ev = [{"e": "move", "who": pid, "path": move["path"], "caps": move["caps"], "king": crowned}]
        ids = self.ids()
        other = ids[1] if pid == ids[0] else ids[0]
        self.next_turn(other)
        if not self.legal(other):
            self.finish([[pid], [other]])
        elif self.s["quiet"] >= 50:
            self.finish([ids])
            ev.append({"e": "draw"})
        return ev

    def on_timeout(self, now):
        pid = self.s["turn"]
        return self._apply(pid, self.rng.choice(self.legal(pid)))

    def forfeit(self, pid, now):
        other = next(x for x in self.ids() if x != pid)
        self.finish([[other], [pid]])
        return [{"e": "forfeit", "who": pid}]
