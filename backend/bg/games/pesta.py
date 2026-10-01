"""Pesta mode: a Mario Party–style run of random minigames.

roulette (the minigame wheel) → intro (how to play, everyone taps Ready) → play (the minigame
itself, run inside this game) → result (coins for placements) → … → bonus stars → the end.
Coins decide the winner."""

from __future__ import annotations

from .base import IllegalMove, ch, opt, rank_by_score
from .mario import Mini
from .mp_arena import (FloorIsFalling, HotCrossBlocks, HotHotHop, RoboArmWrestle, RockyRopeRace, ShadowPlay,
                       SlappyGoRound, SnagTheFlags, StampOut, SumoCircuit, SunsetStandoff)
from .mp_solo import (BowserChicken, BowserFilter, CameraReady, CoinConveyor, ElectricEscape, GoldNBrown, HammerItHome,
                      KongaLine, LaneChange, NogginKnock, PickaxDash, RhythmKitchen, SpeakUpJunior, StoneEyeBowling,
                      TiltAGolf)
from .mp_luck import LostAndPound, SleightOfShell, TrickyTurntable
from .mp_reflex import FastFishing, KnockKnockMatch, SledToTheEdge, TalkingFlowerSays
from .mp_watch import BigTopQuiz, BuzzerBeater, ThwompDiff

MINIS: list[type[Mini]] = [ThwompDiff, BigTopQuiz, BuzzerBeater, SleightOfShell, TrickyTurntable, LostAndPound,
                           SledToTheEdge, FastFishing, TalkingFlowerSays, KnockKnockMatch]
MINIS2: list[type[Mini]] = [SumoCircuit, HotCrossBlocks, ShadowPlay, CoinConveyor, ElectricEscape, BowserFilter,
                            CameraReady, GoldNBrown, NogginKnock, LaneChange, SlappyGoRound, StoneEyeBowling,
                            FloorIsFalling, HotHotHop, StampOut, SnagTheFlags, SunsetStandoff, RoboArmWrestle,
                            RockyRopeRace, RhythmKitchen, KongaLine, TiltAGolf, PickaxDash, HammerItHome,
                            BowserChicken, SpeakUpJunior]
ALL = MINIS + MINIS2
BY_KEY = {m.key: m for m in ALL}
COINS = {2: [10, 0], 3: [10, 5, 0], 4: [10, 6, 3, 0]}
ROULETTE, INTRO, RESULT, BONUS = 4.2, 25.0, 5.5, 9.0


class Pesta(Mini):
    key, name_id, name_en, icon = "mp_pesta", "Minigame Party", "Minigame Party", "🎉"
    options = [opt("count", "Jumlah minigame", "Minigames", "select", 6, [ch(n, str(n)) for n in (4, 6, 8, 10)]),
               opt("games", "Minigame yang ikut", "Minigames included", "multi",
                   [m.key for m in ALL if getattr(m, "party_default", True)], [ch(m.key, m.name_en) for m in ALL],
                   help_id="Game sensor/mikrofon (Tilt-a-Golf, Pickax Dash, Bowser Chicken, Speak Up) tidak ikut kecuali dipilih.",
                   help_en="Sensor/microphone games (Tilt-a-Golf, Pickax Dash, Bowser Chicken, Speak Up) are off unless chosen."),
               opt("bonus", "Bintang bonus di akhir", "Bonus stars at the end", "bool", True)]

    @classmethod
    def setup(cls, players, options, rng, now):
        keys = [k for k in (options.get("games") or []) if k in BY_KEY] or [m.key for m in MINIS]
        keys = [k for k in keys if BY_KEY[k].min_players <= len(players) <= BY_KEY[k].max_players] or [m.key for m in MINIS]
        n = int(options.get("count", 6))
        order, bag = [], []
        while len(order) < n:
            if not bag:
                bag = keys[:]
                rng.shuffle(bag)
                if order and len(bag) > 1 and bag[0] == order[-1]:
                    bag.append(bag.pop(0))
            order.append(bag.pop(0))
        ids = [p["id"] for p in players]
        st = cls.init(players, now, order=order, idx=-1, coins={p: 0 for p in ids}, places={p: [] for p in ids},
                      sub=None, ready=[], last=None, bonus=[], use_bonus=bool(options.get("bonus", True)))
        st["rounds"] = n
        return st

    # ---- the running minigame -----------------------------------------------------------------------
    def sub(self) -> Mini | None:
        sub = self.s.get("sub")
        return BY_KEY[sub["key"]](sub["s"], self.rng) if sub else None

    def begin(self, now):
        return self._roulette(now)

    def _roulette(self, now):
        s = self.s
        s["idx"] += 1
        s["round"] = s["idx"] + 1
        s["sub"], s["ready"], s["last"] = None, [], None
        self.go("roulette", now, ROULETTE)
        return [{"e": "roulette", "key": s["order"][s["idx"]]}]

    def on_roulette(self, now):
        self.go("intro", now, INTRO)
        return [{"e": "intro"}]

    def on_intro(self, now):
        s = self.s
        cls = BY_KEY[s["order"][s["idx"]]]
        opts = {o["key"]: o["default"] for o in cls.options}
        opts.update(cls.party_options)
        s["sub"] = {"key": cls.key, "s": cls.setup(s["players"], opts, self.rng, now)}
        self.go("play", now, None)
        return [{"e": "play", "key": cls.key}]

    def tick(self, now):
        s = self.s
        if self.over:
            return []
        if s["phase"] == "play":
            g = self.sub()
            ev = g.tick(now)
            if g.over:
                ev += self._result(now, g)
            return ev
        return super().tick(now)

    def _result(self, now, g: Mini):
        s = self.s
        n = len(self.ids())
        table = COINS.get(n, [10, 6, 3, 0] + [0] * n)
        res = {r["id"]: r for r in g.results()}
        got = {}
        for pid in self.ids():
            rank = res.get(pid, {}).get("rank", n)
            c = table[min(rank - 1, len(table) - 1)]
            got[pid] = c
            s["coins"][pid] += c
            s["places"][pid].append(rank)
            if rank == 1:
                self.bump("mini_wins", pid)
        for stat, vals in g.stats().items():
            mine = s.setdefault("stats", {}).setdefault(stat, {})
            for p, v in vals.items():
                mine[p] = min(mine.get(p, v), v) if stat == "reaction" else mine.get(p, 0) + v
        s["scores"] = dict(s["coins"])
        s["last"] = {"key": g.key, "ranks": {pid: res.get(pid, {}).get("rank", n) for pid in self.ids()}, "coins": got,
                     "scores": g.s.get("scores", {})}
        s["sub"] = None
        self.go("result", now, RESULT)
        return [{"e": "result", **s["last"]}]

    def on_result(self, now):
        s = self.s
        if s["idx"] + 1 >= len(s["order"]):
            if s["use_bonus"]:
                return self._bonus(now)
            return self.end(now, rank_by_score(self.ids(), s["coins"]))
        return self._roulette(now)

    def _bonus(self, now):
        s = self.s
        ids = self.ids()
        bonus = []

        def star(key, name_id, name_en, emoji, values, best=max):
            top = best(values.values())
            if top <= 0 and best is max:
                return
            win = [p for p, v in values.items() if v == top]
            for p in win:
                s["coins"][p] += 15
            bonus.append({"key": key, "id": name_id, "en": name_en, "emoji": emoji, "who": win, "value": top})

        star("minigame", "Bintang Minigame", "Minigame Star", "🏆", {p: s["places"][p].count(1) for p in ids})
        star("runner", "Bintang Hampir", "So-Close Star", "🥈", {p: s["places"][p].count(2) for p in ids})
        star("steady", "Bintang Konsisten", "Steady Star", "🎯",
             {p: -sum(s["places"][p]) for p in ids}, best=lambda v: max(v))
        s["bonus"] = bonus
        s["scores"] = dict(s["coins"])
        self.go("bonus", now, BONUS)
        return [{"e": "bonus", "bonus": bonus}]

    def on_bonus(self, now):
        return self.end(now, rank_by_score(self.ids(), self.s["coins"]))

    # ---- views and moves ----------------------------------------------------------------------------
    def party(self) -> dict:
        s = self.s
        cur = s["order"][s["idx"]] if 0 <= s["idx"] < len(s["order"]) else None
        return {"phase": s["phase"], "idx": s["idx"], "count": len(s["order"]), "order": s["order"], "key": cur,
                "coins": s["coins"], "places": s["places"], "ready": s["ready"], "last": s["last"], "bonus": s["bonus"],
                "deadline": s["deadline"], "t0": s["t0"], "limit": s["limit"], "all": sorted(set(s["order"]))}

    def view(self, pid):
        s = self.s
        tail = {"over": self.over, "results": s.get("results", []) if self.over else [], "party": self.party()}
        if s["phase"] == "play" and s["sub"]:
            return {**self.sub().view(pid), **tail}
        return {**self.base_view(), **tail, "scores": s["coins"], "phase": s["phase"], "deadline": s["deadline"],
                "limit": s["limit"], "t0": s["t0"]}

    def act(self, pid, a, now):
        s = self.s
        if a.get("do") == "ready":
            if s["phase"] != "intro":
                return []
            if pid not in s["ready"]:
                s["ready"].append(pid)
            if len(s["ready"]) == len(self.ids()):
                s["deadline"] = min(s["deadline"], now + 1.2)
            return [{"e": "ready", "who": pid}]
        if s["phase"] != "play" or not s["sub"]:
            raise IllegalMove("Wait for the minigame to start.")
        g = self.sub()
        ev = g.act(pid, a, now)
        if g.over:
            ev += self._result(now, g)
        return ev

    def forfeit(self, pid, now):
        others = [p for p in self.ids() if p != pid]
        self.finish(rank_by_score(others, self.s["coins"]) + [[pid]], self.s["coins"])
        return [{"e": "forfeit", "who": pid}]
