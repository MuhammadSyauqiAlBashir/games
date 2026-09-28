"""Sequence (official rules), 2–4 players; 4 players play as 2 teams of 2.

The 10×10 board shows every non-jack card twice; the 4 corners are free for everyone.
Play a card, put a chip on one of its two squares, draw a card.
- Two-eyed jacks (♦ ♣) are wild: a chip on any empty square.
- One-eyed jacks (♥ ♠) remove an opponent's chip that isn't part of a finished sequence.
- A dead card (both squares taken) may be swapped for a new one, once per turn, before playing.
- A sequence is 5 in a row (corners count). With 2 sides you need 2 sequences (they may
  share one chip); with 3 players, 1 sequence wins.
Hand size: 2 players 7 cards, 3 players 6, 4 players 6."""

from __future__ import annotations

import random

from .base import Game, IllegalMove
from .cards import RANKS, SUITS

TWO_EYED = ("JD", "JC")
ONE_EYED = ("JH", "JS")
CORNERS = (0, 9, 90, 99)
HAND = {2: 7, 3: 6, 4: 6}


def make_layout() -> list[str]:
    cards = [r + s for s in SUITS for r in RANKS if r != "J"] * 2
    random.Random(1962).shuffle(cards)  # a fixed board, the same every game
    layout, it = [], iter(cards)
    for i in range(100):
        layout.append("XX" if i in CORNERS else next(it))
    return layout


LAYOUT = make_layout()
SPOTS: dict[str, list[int]] = {}
for _i, _c in enumerate(LAYOUT):
    if _c != "XX":
        SPOTS.setdefault(_c, []).append(_i)


class Sequence(Game):
    key, name_id, name_en, icon = "sequence", "Sequence", "Sequence", "🃏"
    min_players, max_players = 2, 4
    santai_ok = True
    teams = True
    default_timer = 60
    options = []

    @classmethod
    def setup(cls, players, options, rng, now):
        deck = [r + s for s in SUITS for r in RANKS] * 2
        rng.shuffle(deck)
        n = len(players)
        hands = {p["id"]: [deck.pop() for _ in range(HAND[n])] for p in players}
        teams = {p["id"]: (i % 2 if n == 4 else i) for i, p in enumerate(players)}
        n_teams = len(set(teams.values()))
        return {"players": players, "chips": [""] * 100, "hands": hands, "deck": deck, "discard": [],
                "teams": teams, "need": 2 if n_teams == 2 else 1, "seqs": {str(t): [] for t in set(teams.values())},
                "turn": players[0]["id"], "turn_no": 1, "swapped": False, "last": None}

    def view(self, pid):
        s = self.s
        return {**self.base_view(), "layout": LAYOUT, "chips": s["chips"], "hand": s["hands"].get(pid, []) if pid else [],
                "counts": {p: len(h) for p, h in s["hands"].items()}, "teams": s["teams"], "need": s["need"],
                "seqs": s["seqs"], "deck": len(s["deck"]), "discard": s["discard"][-1] if s["discard"] else None,
                "swapped": s["swapped"], "last": s["last"],
                "dead": [i for i, c in enumerate(s["hands"].get(pid, [])) if self.is_dead(c)] if pid else []}

    def is_dead(self, card: str) -> bool:
        if card[0] == "J":
            return False
        return all(self.s["chips"][i] for i in SPOTS[card])

    def in_sequence(self, cell: int) -> bool:
        return any(cell in seq for seqs in self.s["seqs"].values() for seq in seqs)

    def targets(self, pid: str, card: str) -> list[int]:
        chips, team = self.s["chips"], str(self.s["teams"][pid])
        if card in TWO_EYED:
            return [i for i in range(100) if i not in CORNERS and not chips[i]]
        if card in ONE_EYED:
            return [i for i in range(100) if chips[i] and chips[i] != team and not self.in_sequence(i)]
        return [i for i in SPOTS[card] if not chips[i]]

    def act(self, pid, a, now):
        if self.over or pid != self.s["turn"]:
            raise IllegalMove("Not your turn.")
        hand = self.s["hands"][pid]
        if "dead" in a:
            i = int(a["dead"])
            if self.s["swapped"] or not 0 <= i < len(hand) or not self.is_dead(hand[i]):
                raise IllegalMove("You can swap one dead card per turn.")
            self.s["discard"].append(hand.pop(i))
            self._draw(pid)
            self.s["swapped"] = True
            self.s["turn_no"] += 1
            return [{"e": "dead", "who": pid}]
        i, cell = int(a.get("card", -1)), int(a.get("cell", -1))
        if not 0 <= i < len(hand):
            raise IllegalMove("Pick a card.")
        if cell not in self.targets(pid, hand[i]):
            raise IllegalMove("You can't use that card there.")
        return self._play(pid, i, cell)

    def _draw(self, pid):
        if not self.s["deck"]:
            self.s["deck"], self.s["discard"] = self.s["discard"], []
            self.rng.shuffle(self.s["deck"])
        if self.s["deck"]:
            self.s["hands"][pid].append(self.s["deck"].pop())

    def _play(self, pid, i, cell):
        card = self.s["hands"][pid].pop(i)
        self.s["discard"].append(card)
        team = str(self.s["teams"][pid])
        ev = {"e": "play", "who": pid, "card": card, "cell": cell}
        if card in ONE_EYED:
            ev["removed"] = self.s["chips"][cell]
            self.s["chips"][cell] = ""
            self.bump("removed", pid)
        else:
            self.s["chips"][cell] = team
            new = self._new_sequences(team, cell)
            if new:
                self.s["seqs"][team] += new
                ev["seq"] = new
                self.bump("sequences", pid, len(new))
        self.s["last"] = cell
        self._draw(pid)
        self.s["swapped"] = False
        if len(self.s["seqs"][team]) >= self.s["need"]:
            winners = [p for p, t in self.s["teams"].items() if str(t) == team]
            losers = [p for p in self.ids() if p not in winners]
            self.finish([winners, losers], {p: len(self.s["seqs"][str(self.s["teams"][p])]) for p in self.ids()})
            return [ev]
        ids = self.ids()
        self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])
        return [ev]

    def _new_sequences(self, team: str, cell: int) -> list[list[int]]:
        chips = self.s["chips"]

        def mine(r, c):
            if not (0 <= r < 10 and 0 <= c < 10):
                return False
            i = r * 10 + c
            return i in CORNERS or chips[i] == team

        existing = [set(s) for s in self.s["seqs"][team]]
        added: list[list[int]] = []
        r0, c0 = divmod(cell, 10)
        for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
            back = 0
            while mine(r0 - (back + 1) * dr, c0 - (back + 1) * dc):
                back += 1
            run = []
            k = -back
            while mine(r0 + k * dr, c0 + k * dc):
                run.append((r0 + k * dr) * 10 + (c0 + k * dc))
                k += 1
            for start in range(0, len(run) - 4):
                w = run[start:start + 5]
                if cell not in w:
                    continue
                ws = set(w)
                if all(len(ws & e) <= 1 for e in existing) and all(len(ws & set(a)) <= 1 for a in added):
                    added.append(w)
        return added

    def on_timeout(self, now):
        pid = self.s["turn"]
        hand = self.s["hands"][pid]
        order = sorted(range(len(hand)), key=lambda i: hand[i][0] == "J")  # keep jacks if possible
        for i in order:
            t = self.targets(pid, hand[i])
            if t:
                return self._play(pid, i, self.rng.choice(t))
        # Nothing playable at all (very rare): discard and pass.
        self.s["discard"].append(hand.pop(0))
        self._draw(pid)
        ids = self.ids()
        self.next_turn(ids[(ids.index(pid) + 1) % len(ids)])
        return [{"e": "pass", "who": pid}]
