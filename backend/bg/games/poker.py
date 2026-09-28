"""Texas Hold'em No-Limit with play-money Rupiah.

Everyone sits down with their wallet for the day (Rp1.000.000, reset 00:00 WIB). Blinds
start at Rp10.000 / Rp20.000 and rise every 10 minutes. Side pots, all-ins and split
pots are handled. The last player with chips wins the table; busted players sit out
until tomorrow. Leaving the table early keeps your chips (they go back to your wallet)."""

from __future__ import annotations

from .. import wallet
from .base import Game, IllegalMove
from .cards import CATEGORY, CATEGORY_ID, best_hand, deck

LEVELS = [(10_000, 20_000), (20_000, 40_000), (30_000, 60_000), (50_000, 100_000), (75_000, 150_000),
          (100_000, 200_000), (150_000, 300_000), (200_000, 400_000), (300_000, 600_000), (500_000, 1_000_000)]
LEVEL_SECONDS = 600
SHOWDOWN_SECONDS = 6


class Poker(Game):
    key, name_id, name_en, icon = "poker", "Poker", "Poker", "♠️"
    min_players, max_players = 2, 6
    santai_ok = False
    prefetch = False  # wallets must be read at the moment the game starts
    default_timer = 45
    options = []

    # ---- wallets ------------------------------------------------------------------------
    @classmethod
    async def can_start(cls, seats, options):
        broke = [s["name"] for s in seats if await wallet.balance(s["id"]) <= 0]
        if broke:
            return "Out of chips for today: " + ", ".join(broke) + " (resets at 00:00 WIB)."
        return None

    @classmethod
    async def prepare(cls, seats, options, rng):
        return {"stacks": {s["id"]: await wallet.balance(s["id"]) for s in seats}}

    @classmethod
    async def after_finish(cls, game, room):
        stacks = game.s["stacks"]
        for pid, amount in stacks.items():
            await wallet.set_balance(pid, amount)
        return {"stacks": stacks}

    # ---- setup -------------------------------------------------------------------------------
    @classmethod
    def setup(cls, players, options, rng, now):
        stacks = dict((options.get("__content") or {}).get("stacks") or {p["id"]: wallet.DAILY for p in players})
        s = {"players": players, "stacks": stacks, "start": dict(stacks), "button": -1, "busted": [], "left": [],
             "hand_no": 0, "turn_no": 0, "phase": "hand", "deadline": None, "log": [], "scores": dict(stacks)}
        g = cls(s, rng)
        g._new_hand(now)
        return s

    def seated(self) -> list[str]:
        return [p for p in self.ids() if self.s["stacks"].get(p, 0) > 0 and p not in self.s["left"]]

    def blinds(self, now: float) -> tuple[int, int, int]:
        lvl = min(len(LEVELS) - 1, int(now // LEVEL_SECONDS))
        return (*LEVELS[lvl], lvl)

    def _new_hand(self, now):
        s = self.s
        players = self.seated()
        ids = self.ids()
        # Move the button to the next seated player.
        b = s["button"]
        for _ in range(len(ids)):
            b = (b + 1) % len(ids)
            if ids[b] in players:
                break
        s["button"] = b
        order = [ids[(b + k) % len(ids)] for k in range(len(ids)) if ids[(b + k) % len(ids)] in players]
        sb_amt, bb_amt, lvl = self.blinds(now)
        cards = deck()
        self.rng.shuffle(cards)
        hand = {"order": order, "deck": cards, "hole": {p: [cards.pop(), cards.pop()] for p in order}, "board": [],
                "contrib": {p: 0 for p in order}, "bets": {p: 0 for p in order}, "folded": [], "allin": [],
                "street": "preflop", "current": 0, "min_raise": bb_amt, "acted": [], "sb": sb_amt, "bb": bb_amt,
                "level": lvl, "result": None}
        s["hand"] = hand
        s["hand_no"] += 1
        s["phase"] = "hand"
        s["deadline"] = None
        heads_up = len(order) == 2
        sb_p = order[0] if heads_up else order[1 % len(order)]
        bb_p = order[1] if heads_up else order[2 % len(order)]
        hand["sb_p"], hand["bb_p"] = sb_p, bb_p
        self._put(sb_p, sb_amt)
        self._put(bb_p, bb_amt)
        hand["current"] = max(hand["bets"].values())
        first = order[0] if heads_up else order[3 % len(order)]
        s["log"] = [f"Hand #{s['hand_no']} · blinds {sb_amt:,}/{bb_amt:,}".replace(",", ".")]
        self._set_turn(first)

    def _put(self, pid, amount):
        s, h = self.s, self.s["hand"]
        amount = min(amount, s["stacks"][pid])
        s["stacks"][pid] -= amount
        h["bets"][pid] += amount
        h["contrib"][pid] += amount
        if s["stacks"][pid] == 0 and pid not in h["allin"]:
            h["allin"].append(pid)

    def live(self) -> list[str]:
        h = self.s["hand"]
        return [p for p in h["order"] if p not in h["folded"]]

    def can_act(self) -> list[str]:
        h = self.s["hand"]
        return [p for p in self.live() if p not in h["allin"]]

    def _set_turn(self, pid):
        h = self.s["hand"]
        order = h["order"]
        k = order.index(pid)
        for step in range(len(order)):
            cand = order[(k + step) % len(order)]
            if cand in self.can_act():
                self.next_turn(cand)
                return
        self.next_turn(None)

    # ---- views -----------------------------------------------------------------------------------
    def view(self, pid):
        s, h = self.s, self.s["hand"]
        show = h["result"]["shown"] if h.get("result") else {}
        to_call = max(0, h["current"] - h["bets"].get(pid, 0)) if pid in h["order"] else 0
        legal = {}
        if pid and pid == s["turn"] and s["phase"] == "hand":
            stack = s["stacks"][pid]
            legal = {"fold": to_call > 0, "check": to_call == 0, "call": min(to_call, stack) if to_call else 0,
                     "min_raise": min(h["current"] + h["min_raise"], h["bets"][pid] + stack),
                     "max_raise": h["bets"][pid] + stack, "can_raise": stack > to_call}
        sb, bb, lvl = h["sb"], h["bb"], h["level"]
        return {**self.base_view(), "stacks": s["stacks"], "order": h["order"], "button": self.ids()[s["button"]],
                "sb_p": h["sb_p"], "bb_p": h["bb_p"], "board": h["board"], "hole": h["hole"].get(pid, []) if pid else [],
                "shown": show, "bets": h["bets"], "pot": sum(h["contrib"].values()), "folded": h["folded"],
                "allin": h["allin"], "street": h["street"], "to_call": to_call, "legal": legal, "blinds": [sb, bb],
                "level": lvl, "next_level": (lvl + 1) * LEVEL_SECONDS, "phase": s["phase"], "result": h["result"],
                "deadline": s["deadline"], "busted": s["busted"], "left": s["left"], "log": s["log"][-6:],
                "hand_no": s["hand_no"], "start": s["start"]}

    # ---- betting ----------------------------------------------------------------------------------
    def act(self, pid, a, now):
        s = self.s
        do = a.get("do")
        if do == "leave":
            return self.forfeit(pid, now)
        if self.over or s["phase"] != "hand" or pid != s["turn"]:
            raise IllegalMove("Not your turn.")
        h = s["hand"]
        to_call = h["current"] - h["bets"][pid]
        stack = s["stacks"][pid]
        name = self.name(pid)
        if do == "fold":
            h["folded"].append(pid)
            self._log(f"{name} fold")
        elif do == "check":
            if to_call > 0:
                raise IllegalMove("You have to call or fold.")
            self._log(f"{name} check")
        elif do == "call":
            if to_call <= 0:
                raise IllegalMove("Nothing to call — check.")
            self._put(pid, to_call)
            self._log(f"{name} call {min(to_call, stack):,}".replace(",", "."))
        elif do in ("raise", "allin"):
            target = h["bets"][pid] + stack if do == "allin" else int(a.get("to", 0))
            max_to = h["bets"][pid] + stack
            target = min(target, max_to)
            min_to = h["current"] + h["min_raise"]
            if target <= h["current"]:
                raise IllegalMove("Raise to more than the current bet.")
            if target < min_to and target < max_to:
                raise IllegalMove(f"Minimum raise is to {min_to:,}.".replace(",", "."))
            raise_by = target - h["current"]
            self._put(pid, target - h["bets"][pid])
            if raise_by >= h["min_raise"]:
                h["min_raise"] = raise_by
                h["acted"] = []  # everyone must respond to a full raise
            h["current"] = max(h["current"], h["bets"][pid])
            self._log(f"{name} {'all-in' if h['bets'][pid] == max_to else 'raise to'} {h['bets'][pid]:,}".replace(",", "."))
            if pid in h["allin"]:
                self.bump("allins", pid)
        else:
            raise IllegalMove("Unknown action.")
        if pid not in h["acted"]:
            h["acted"].append(pid)
        return [{"e": "bet", "who": pid, "do": do}] + self._advance(pid, now)

    def _log(self, text):
        self.s["log"].append(text)

    def _advance(self, pid, now):
        h = self.s["hand"]
        live = self.live()
        if len(live) == 1:
            return self._award_uncontested(live[0])
        pending = [p for p in self.can_act() if p not in h["acted"] or h["bets"][p] < h["current"]]
        if pending:
            order = h["order"]
            k = order.index(pid)
            for step in range(1, len(order) + 1):
                cand = order[(k + step) % len(order)]
                if cand in pending:
                    self.next_turn(cand)
                    return []
        return self._next_street(now)

    def _next_street(self, now):
        h = self.s["hand"]
        for p in h["order"]:
            h["bets"][p] = 0
        h["current"], h["min_raise"], h["acted"] = 0, h["bb"], []
        ev = []
        while True:
            if h["street"] == "preflop":
                h["board"] += [h["deck"].pop() for _ in range(3)]
                h["street"] = "flop"
            elif h["street"] == "flop":
                h["board"].append(h["deck"].pop())
                h["street"] = "turn"
            elif h["street"] == "turn":
                h["board"].append(h["deck"].pop())
                h["street"] = "river"
            else:
                return ev + self._showdown(now)
            ev.append({"e": "street", "street": h["street"]})
            if len(self.can_act()) >= 2:
                break
            # Everyone (or all but one) is all-in: deal the rest without betting.
        start = self.s["button"]
        ids = self.ids()
        # First to act after the flop: first active player left of the button.
        for k in range(1, len(ids) + 1):
            cand = ids[(start + k) % len(ids)]
            if cand in self.can_act():
                self.next_turn(cand)
                break
        return ev

    def _award_uncontested(self, winner):
        h = self.s["hand"]
        pot = sum(h["contrib"].values())
        self.s["stacks"][winner] += pot
        h["result"] = {"winners": [{"id": winner, "amount": pot, "hand": ""}], "shown": {}}
        self._log(f"{self.name(winner)} wins {pot:,}".replace(",", "."))
        self._track_pot(winner, pot)
        return [{"e": "win", "who": [winner], "pot": pot}] + self._end_hand()

    def _showdown(self, now):
        h = self.s["hand"]
        live = self.live()
        evals = {p: best_hand(h["hole"][p] + h["board"]) for p in live}
        contrib = h["contrib"]
        levels = sorted(set(v for v in contrib.values() if v > 0))
        prev = 0
        won: dict[str, int] = {}
        for lvl in levels:
            pot = sum(min(c, lvl) - min(c, prev) for c in contrib.values())
            eligible = [p for p in live if contrib[p] >= lvl]
            prev = lvl
            if not pot or not eligible:
                continue
            best = max(evals[p][0] for p in eligible)
            winners = [p for p in eligible if evals[p][0] == best]
            share, rest = divmod(pot, len(winners))
            for i, p in enumerate(winners):
                won[p] = won.get(p, 0) + share + (rest if i == 0 else 0)
        for p, amt in won.items():
            self.s["stacks"][p] += amt
            self._track_pot(p, amt)
        shown = {p: h["hole"][p] for p in live}
        h["result"] = {"winners": [{"id": p, "amount": amt, "hand": CATEGORY[evals[p][0][0]],
                                    "hand_id": CATEGORY_ID[evals[p][0][0]], "best": evals[p][1]} for p, amt in won.items()],
                       "shown": shown, "hands": {p: {"en": CATEGORY[evals[p][0][0]], "id": CATEGORY_ID[evals[p][0][0]]}
                                                 for p in live}}
        for p, amt in won.items():
            self._log(f"{self.name(p)} wins {amt:,} — {CATEGORY[evals[p][0][0]]}".replace(",", "."))
        return [{"e": "showdown", "who": list(won)}] + self._end_hand()

    def _track_pot(self, pid, amount):
        st = self.s.setdefault("stats", {}).setdefault("biggest_pot", {})
        st[pid] = max(st.get(pid, 0), amount)
        self.bump("hands_won", pid)

    def _end_hand(self):
        s = self.s
        s["phase"] = "showdown"
        s["deadline"] = None
        s["turn"] = None
        s["turn_no"] += 1
        for p in s["hand"]["order"]:
            if s["stacks"][p] == 0 and p not in s["busted"]:
                s["busted"].append(p)
        s["scores"] = dict(s["stacks"])
        if len(self.seated()) <= 1:
            self._final()
        return []

    def _final(self):
        s = self.s
        alive = sorted(self.seated(), key=lambda p: -s["stacks"][p])
        leavers = sorted(s["left"], key=lambda p: -s["stacks"][p])
        self.finish([[p] for p in alive] + [[p] for p in leavers] + [[p] for p in reversed(s["busted"])],
                    dict(s["stacks"]))

    def tick(self, now):
        s = self.s
        if self.over or s["phase"] != "showdown":
            return []
        if s["deadline"] is None:
            s["deadline"] = now + SHOWDOWN_SECONDS
            return []
        if now >= s["deadline"]:
            self._new_hand(now)
            return [{"e": "newhand", "n": s["hand_no"]}]
        return []

    def turn(self):
        return [self.s["turn"]] if self.s.get("turn") and self.s["phase"] == "hand" and not self.over else []

    def on_timeout(self, now):
        s = self.s
        pid = s["turn"]
        h = s["hand"]
        do = "check" if h["current"] - h["bets"][pid] <= 0 else "fold"
        return self.act(pid, {"do": do}, now)

    def forfeit(self, pid, now):
        s = self.s
        if pid in s["left"] or pid in s["busted"]:
            raise IllegalMove("You're not at the table.")
        h = s["hand"]
        ev = [{"e": "leave", "who": pid}]
        s["left"].append(pid)
        if s["phase"] == "hand" and pid in h["order"] and pid not in h["folded"]:
            h["folded"].append(pid)
            if s["turn"] == pid:
                ev += self._advance(pid, now)
            elif len(self.live()) == 1:
                ev += self._award_uncontested(self.live()[0])
        if not self.over and len(self.seated()) <= 1:
            if s["phase"] == "hand":
                # Give the remaining pot back to the last player and end.
                live = self.live()
                if live:
                    s["stacks"][live[0]] += sum(h["contrib"].values())
                    for p in h["order"]:
                        h["contrib"][p] = 0
            self._final()
        return ev
