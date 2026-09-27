"""UNO (official rules + optional house rules).

Cards: "R5", "GS" (skip), "BR" (reverse), "YD" (draw two), "W" (wild), "W4" (wild draw four).
Official: match colour, number or symbol; draw 1 if you can't (you may play it if it fits);
Wild +4 may be challenged (only legal without a card of the current colour); call UNO at one
card or draw 2 if caught; score the other hands, first to 500 wins (or a single round).
House rules (room options): stacking (+2 on +2, +4 on +4), draw until playable, jump-in,
7-0 (7 swaps hands with someone, 0 passes all hands), +4 any time (no challenge)."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

COLORS = "RGBY"


def new_deck() -> list[str]:
    d = []
    for c in COLORS:
        d.append(c + "0")
        for v in "123456789SRD":
            d += [c + v, c + v]
    d += ["W"] * 4 + ["W4"] * 4
    return d


def points(card: str) -> int:
    if card.startswith("W"):
        return 50
    return 20 if card[1] in "SRD" else int(card[1])


class Uno(Game):
    key, name_id, name_en, icon = "uno", "UNO", "UNO", "🟥"
    min_players, max_players = 2, 6
    santai_ok = True
    default_timer = 30
    options = [
        opt("target", "Menang", "Win", "select", 0, [ch(0, "Satu ronde", "Single round"), ch(500, "Sampai 500 poin", "First to 500")]),
        opt("stack", "Tumpuk +2/+4", "Stacking +2/+4", "bool", False),
        opt("draw_until", "Ambil sampai bisa main", "Draw until playable", "bool", False),
        opt("jump_in", "Jump-in (kartu kembar)", "Jump-in (identical card)", "bool", False),
        opt("seven_zero", "Aturan 7-0", "7-0 rule", "bool", False),
        opt("w4_any", "+4 kapan saja (tanpa challenge)", "+4 any time (no challenge)", "bool", False),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        s = {"players": players, "scores": {p["id"]: 0 for p in players}, "round": 0,
             "rules": {k: options.get(k) for k in ("stack", "draw_until", "jump_in", "seven_zero", "w4_any")},
             "target": int(options.get("target") or 0), "turn_no": 0, "dealer": len(players) - 1}
        game = cls(s, rng)
        game._deal()
        return s

    # ---- rounds ------------------------------------------------------------------------
    def _deal(self):
        s = self.s
        deck = new_deck()
        self.rng.shuffle(deck)
        ids = self.ids()
        s["hands"] = {p: [deck.pop() for _ in range(7)] for p in ids}
        while True:  # start with a number card
            top = deck.pop()
            if top[0] in COLORS and top[1].isdigit():
                break
            deck.insert(0, top)
        s.update({"deck": deck, "discard": [top], "color": top[0], "dir": 1, "pending": 0, "pending_kind": "",
                  "phase": "play", "called": [], "vulnerable": None, "drawn": None, "prev_color": None,
                  "offender": None, "round": s["round"] + 1, "round_over": None, "deadline": None})
        s["dealer"] = (s["dealer"] + 1) % len(ids)
        self.next_turn(ids[(s["dealer"] + 1) % len(ids)])

    def top(self) -> str:
        return self.s["discard"][-1]

    def _next(self, pid: str, skip: int = 0) -> str:
        ids = self.ids()
        return ids[(ids.index(pid) + self.s["dir"] * (1 + skip)) % len(ids)]

    def _draw(self, pid: str, n: int) -> list[str]:
        s, got = self.s, []
        for _ in range(n):
            if not s["deck"]:
                keep = s["discard"][-1]
                s["deck"] = s["discard"][:-1]
                s["discard"] = [keep]
                self.rng.shuffle(s["deck"])
            if not s["deck"]:
                break
            got.append(s["deck"].pop())
        s["hands"][pid] += got
        if len(s["hands"][pid]) > 1 and pid in s["called"]:
            s["called"].remove(pid)
        self.bump("drawn", pid, len(got))
        return got

    def playable(self, pid: str, card: str) -> bool:
        s = self.s
        if s["pending"]:
            return bool(s["rules"]["stack"]) and ((card == "W4" and s["pending_kind"] == "W4") or
                                                  (card[1:] == "D" and s["pending_kind"] == "D"))
        if card.startswith("W"):
            return True
        top = self.top()
        return card[0] == s["color"] or (not top.startswith("W") and card[1:] == top[1:])

    def view(self, pid):
        s = self.s
        hand = s["hands"].get(pid, []) if pid else []
        can = []
        if pid == s["turn"] and s["phase"] in ("play", "drawn"):
            can = [i for i, c in enumerate(hand) if self.playable(pid, c) and (s["phase"] == "play" or i == s["drawn"])]
        jump = []
        if pid and s["rules"]["jump_in"] and pid != s["turn"] and s["phase"] == "play" and not s["pending"]:
            t = self.top()
            jump = [i for i, c in enumerate(hand) if not c.startswith("W") and c == t]
        return {**self.base_view(), "hand": hand, "can": can, "jump": jump,
                "counts": {p: len(h) for p, h in s["hands"].items()}, "top": self.top(), "color": s["color"],
                "dir": s["dir"], "pending": s["pending"], "phase": s["phase"], "called": s["called"],
                "vulnerable": s["vulnerable"], "scores": s["scores"], "round": s["round"], "target": s["target"],
                "rules": s["rules"], "deck": len(s["deck"]), "drawn": s["drawn"] if pid == s["turn"] else None,
                "round_over": s["round_over"], "deadline": s["deadline"],
                "offender": s["offender"]}

    # ---- actions --------------------------------------------------------------------------
    def act(self, pid, a, now):
        s = self.s
        if self.over:
            raise IllegalMove("The game is over.")
        do = a.get("do")
        if do == "uno":
            return self._call(pid)
        if do == "catch":
            return self._catch(pid)
        if s["phase"] == "round_over":
            raise IllegalMove("Next round is starting…")
        if do == "play" and pid != s["turn"]:
            return self._jump_in(pid, int(a.get("i", -1)), now)
        if pid != s["turn"]:
            raise IllegalMove("Not your turn.")
        if s["vulnerable"] and s["vulnerable"] != pid:
            s["vulnerable"] = None  # the next player has acted: too late to catch
        if s["phase"] == "respond4":
            if do == "challenge" and not s["rules"]["w4_any"] and s["pending"] == 4:
                return self._challenge(pid)
            if do == "accept":
                return self._take_pending(pid)
            if do == "play":
                return self._play(pid, int(a.get("i", -1)), a.get("color"), a.get("target"), now)
            raise IllegalMove("Accept the +4 or challenge it.")
        if s["phase"] == "swap":
            if do != "swap":
                raise IllegalMove("Pick someone to swap hands with.")
            return self._swap(pid, str(a.get("target")))
        if do == "draw":
            if s["phase"] != "play":
                raise IllegalMove("Play the card you drew or keep it.")
            return self._draw_action(pid)
        if do == "keep":
            if s["phase"] != "drawn":
                raise IllegalMove("Nothing to keep.")
            s["phase"], s["drawn"] = "play", None
            self.next_turn(self._next(pid))
            return [{"e": "keep", "who": pid}]
        if do == "play":
            return self._play(pid, int(a.get("i", -1)), a.get("color"), a.get("target"), now)
        raise IllegalMove("Unknown action.")

    def _call(self, pid):
        s = self.s
        if len(s["hands"].get(pid, [])) > 2:
            raise IllegalMove("Call UNO when you're down to your last card.")
        if pid not in s["called"]:
            s["called"].append(pid)
        if s["vulnerable"] == pid:
            s["vulnerable"] = None
        self.s["turn_no"] += 1
        return [{"e": "uno", "who": pid}]

    def _catch(self, pid):
        s = self.s
        v = s["vulnerable"]
        if not v or v == pid or len(s["hands"][v]) != 1:
            raise IllegalMove("Nobody to catch.")
        self._draw(v, 2)
        s["vulnerable"] = None
        self.bump("caught", pid)
        self.s["turn_no"] += 1
        return [{"e": "caught", "who": v, "by": pid}]

    def _draw_action(self, pid):
        s = self.s
        if s["pending"]:
            return self._take_pending(pid)
        got = []
        while True:
            got += self._draw(pid, 1)
            card = s["hands"][pid][-1] if got else None
            if not card or self.playable(pid, card) or not s["rules"]["draw_until"] or not s["deck"]:
                break
        card = s["hands"][pid][-1] if got else None
        ev = [{"e": "draw", "who": pid, "n": len(got)}]
        if card and self.playable(pid, card):
            s["phase"], s["drawn"] = "drawn", len(s["hands"][pid]) - 1
            s["turn_no"] += 1
        else:
            self.next_turn(self._next(pid))
        return ev

    def _take_pending(self, pid):
        s = self.s
        n = s["pending"]
        self._draw(pid, n)
        s["pending"], s["pending_kind"], s["phase"], s["offender"] = 0, "", "play", None
        self.next_turn(self._next(pid))
        return [{"e": "draw", "who": pid, "n": n, "penalty": True}]

    def _challenge(self, pid):
        s = self.s
        off = s["offender"]
        guilty = any(c[0] == s["prev_color"] for c in s["hands"][off])
        s["pending"], s["pending_kind"], s["offender"] = 0, "", None
        if guilty:
            self._draw(off, 4)
            s["phase"] = "play"
            s["turn_no"] += 1  # the challenger now plays normally
            self.bump("challenges_won", pid)
            return [{"e": "challenge", "who": pid, "against": off, "guilty": True}]
        self._draw(pid, 6)
        s["phase"] = "play"
        self.next_turn(self._next(pid))
        return [{"e": "challenge", "who": pid, "against": off, "guilty": False}]

    def _swap(self, pid, target):
        s = self.s
        if target == pid or target not in s["hands"]:
            raise IllegalMove("Pick another player.")
        s["hands"][pid], s["hands"][target] = s["hands"][target], s["hands"][pid]
        s["phase"] = "play"
        ev = [{"e": "swap", "who": pid, "with": target}]
        return ev + self._after_play(pid, skip_effects=True)

    def _jump_in(self, pid, i, now):
        s = self.s
        hand = s["hands"].get(pid, [])
        if not (s["rules"]["jump_in"] and s["phase"] == "play" and not s["pending"] and 0 <= i < len(hand)
                and not hand[i].startswith("W") and hand[i] == self.top()):
            raise IllegalMove("Not your turn.")
        s["turn"] = pid
        self.bump("jump_ins", pid)
        return [{"e": "jump", "who": pid}] + self._play(pid, i, None, None, now)

    def _play(self, pid, i, color, target, now):
        s = self.s
        hand = s["hands"][pid]
        if not 0 <= i < len(hand):
            raise IllegalMove("Pick a card.")
        if s["phase"] == "drawn" and i != s["drawn"]:
            raise IllegalMove("You can only play the card you just drew.")
        card = hand[i]
        if s["phase"] == "respond4":
            if not (s["rules"]["stack"] and card == "W4"):
                raise IllegalMove("Only another +4 can be stacked.")
        elif not self.playable(pid, card):
            raise IllegalMove("That card doesn't match.")
        if card.startswith("W") and color not in list(COLORS):
            raise IllegalMove("Choose a colour.")
        prev_color = s["color"]
        hand.pop(i)
        s["discard"].append(card)
        s["drawn"] = None
        s["color"] = color if card.startswith("W") else card[0]
        ev = [{"e": "play", "who": pid, "card": card, "color": s["color"]}]
        if len(hand) == 1 and pid not in s["called"]:
            s["vulnerable"] = pid
        if card == "W4":
            self.bump("plus4", pid)
            s["prev_color"], s["offender"] = prev_color, pid
        if card[1:] == "D":
            self.bump("plus2", pid)
        if s["rules"]["seven_zero"] and card[1:] == "7" and hand and len(self.ids()) > 1:
            s["phase"] = "swap"
            s["turn_no"] += 1
            return ev
        if s["rules"]["seven_zero"] and card[1:] == "0" and hand:
            ids = self.ids()
            order = ids if s["dir"] == 1 else list(reversed(ids))
            hands = [s["hands"][p] for p in order]
            for k, p in enumerate(order):
                s["hands"][p] = hands[(k - 1) % len(order)]
            ev.append({"e": "rotate"})
        return ev + self._after_play(pid)

    def _after_play(self, pid, skip_effects=False):
        s = self.s
        card = self.top()
        n = len(self.ids())
        if not s["hands"][pid]:
            # Last card: the next player still takes a +2/+4.
            if card[1:] == "D" or card == "W4":
                self._draw(self._next(pid), 2 if card[1:] == "D" else 4 + s["pending"])
            return self._round_over(pid)
        if skip_effects:
            self.next_turn(self._next(pid))
            return []
        v = card[1:]
        ev = []
        if card == "W4":
            s["pending"] += 4
            s["pending_kind"] = "W4"
            nxt = self._next(pid)
            if s["rules"]["w4_any"] and not s["rules"]["stack"]:
                self._draw(nxt, s["pending"])
                ev.append({"e": "draw", "who": nxt, "n": s["pending"], "penalty": True})
                s["pending"], s["pending_kind"] = 0, ""
                self.next_turn(self._next(pid, 1))
            else:
                s["phase"] = "respond4"
                self.next_turn(nxt)
        elif v == "D":
            nxt = self._next(pid)
            if s["rules"]["stack"]:
                s["pending"] += 2
                s["pending_kind"] = "D"
                self.next_turn(nxt)
            else:
                self._draw(nxt, 2)
                ev.append({"e": "draw", "who": nxt, "n": 2, "penalty": True})
                self.next_turn(self._next(pid, 1))
        elif v == "S":
            ev.append({"e": "skip", "who": self._next(pid)})
            self.next_turn(self._next(pid, 1))
        elif v == "R":
            if n == 2:
                ev.append({"e": "skip", "who": self._next(pid)})
                self.next_turn(pid)
            else:
                s["dir"] *= -1
                ev.append({"e": "reverse"})
                self.next_turn(self._next(pid))
        else:
            self.next_turn(self._next(pid))
        if s["phase"] not in ("respond4",):
            s["phase"] = "play"
        return ev

    def _round_over(self, winner):
        s = self.s
        pts = sum(points(c) for p, h in s["hands"].items() if p != winner for c in h)
        s["scores"][winner] += pts
        self.bump("rounds_won", winner)
        ev = [{"e": "round", "winner": winner, "points": pts}]
        if not s["target"] or s["scores"][winner] >= s["target"]:
            quit_ = [[p] for p in s.get("quit", [])]
            if s["target"]:
                ranking = sorted(self.ids(), key=lambda p: -s["scores"][p])
                self.finish([[p] for p in ranking] + quit_)
            else:
                others = sorted([p for p in self.ids() if p != winner],
                                key=lambda p: sum(points(c) for c in s["hands"][p]))
                self.finish([[winner]] + [[p] for p in others] + quit_,
                            {p: -sum(points(c) for c in s["hands"][p]) for p in self.ids()} | {winner: pts})
            return ev
        s["phase"], s["round_over"] = "round_over", {"winner": winner, "points": pts}
        s["deadline"] = None  # set by tick on first call
        s["turn"] = None
        s["turn_no"] += 1
        return ev

    def tick(self, now):
        s = self.s
        if s.get("phase") != "round_over" or self.over:
            return []
        if s["deadline"] is None:
            s["deadline"] = now + 6
            return []
        if now >= s["deadline"]:
            self._deal()
            return [{"e": "newround", "round": s["round"]}]
        return []

    def turn(self):
        return [self.s["turn"]] if self.s.get("turn") and not self.over and self.s["phase"] != "round_over" else []

    def on_timeout(self, now):
        s = self.s
        pid = s["turn"]
        if s["phase"] == "respond4":
            return self._take_pending(pid)
        if s["phase"] == "swap":
            target = self.rng.choice([p for p in self.ids() if p != pid])
            return self._swap(pid, target)
        if s["phase"] == "drawn":
            s["phase"], s["drawn"] = "play", None
            self.next_turn(self._next(pid))
            return [{"e": "keep", "who": pid}]
        if s["pending"]:
            return self._take_pending(pid)
        got = self._draw(pid, 1)
        self.next_turn(self._next(pid))
        return [{"e": "draw", "who": pid, "n": len(got)}]

    def forfeit(self, pid, now):
        s = self.s
        ids = self.ids()
        if len(ids) <= 2:
            other = next(x for x in ids if x != pid)
            self.finish([[other], [pid]])
            return [{"e": "forfeit", "who": pid}]
        # Their cards go back to the deck; they leave the table.
        s["deck"] += s["hands"].pop(pid)
        self.rng.shuffle(s["deck"])
        nxt = self._next(pid) if s["turn"] == pid else s["turn"]
        s["players"] = [p for p in s["players"] if p["id"] != pid]
        s.setdefault("quit", []).append(pid)
        s["scores"].setdefault(pid, 0)
        if s["turn"] == pid or nxt == pid:
            s["phase"] = "play"
            self.next_turn(self.ids()[0] if nxt == pid else nxt)
        return [{"e": "forfeit", "who": pid}]
