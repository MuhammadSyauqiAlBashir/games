"""Solo-race minigames: everyone plays their own copy (same seed) on their phone and the phone reports
its score/progress a few times a second; the server keeps the live standings and ranks the result.

These are friends-only games, so the phone is trusted, within limits (scores only go up, at a capped rate)."""

from __future__ import annotations

from .base import IllegalMove, ch, opt
from .mario import PTS, Mini, rank_by_score


class SoloRace(Mini):
    DURATION = 45.0
    ROUNDS = 1
    RACE = False          # True: first to finish wins (then by progress); False: highest score wins
    RATE = 40.0           # max score gain per second (anti-glitch)
    MAX = 10_000.0        # progress cap (e.g. 100 for races)
    party_default = True
    options = []

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", cls.ROUNDS)), seed=0,
                        prog={p: 0.0 for p in ids}, done={}, last={}, got={}, totals={p: 0.0 for p in ids}, extra={})

    def begin(self, now):
        s = self.s
        s["round"] += 1
        s["seed"] = self.rng.randrange(1, 2 ** 31)
        s["prog"] = {p: 0.0 for p in self.ids()}
        s["done"], s["last"], s["got"], s["extra"] = {}, {p: now for p in self.ids()}, {}, {}
        self.go("play", now, self.DURATION)
        return [{"e": "round", "n": s["round"]}]

    def view(self, pid):
        s = self.s
        return self.mview(seed=s["seed"], prog=s["prog"], done=s["done"], got=s["got"], dur=self.DURATION,
                          totals=s["totals"], extra=s["extra"], race=self.RACE, max=self.MAX)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play":
            raise IllegalMove("Not now.")
        if pid in s["done"]:
            return []
        v = float(a.get("v", 0))
        prev = s["prog"].get(pid, 0.0)
        dt = max(0.05, now - s["last"].get(pid, s["t0"]))
        v = max(prev, min(v, prev + self.RATE * dt + 2, self.MAX))
        s["prog"][pid], s["last"][pid] = round(v, 2), now
        if "x" in a:
            s["extra"][pid] = a["x"] if isinstance(a["x"], (int, float, str)) else str(a["x"])[:40]
        ev = [{"e": "prog", "who": pid}]
        if a.get("done"):
            s["done"][pid] = round(now - s["t0"], 3)
            ev.append({"e": "done", "who": pid, "t": s["done"][pid]})
            if len(s["done"]) == len(self.ids()):
                s["deadline"] = min(s["deadline"], now + 0.6)
        return ev

    def round_rank(self) -> list[list[str]]:
        s = self.s
        if self.RACE:
            fin = sorted(s["done"], key=lambda p: s["done"][p])
            groups = [[p] for p in fin]
            rest = [p for p in self.ids() if p not in s["done"]]
            return groups + rank_by_score(rest, s["prog"])
        return rank_by_score(self.ids(), s["prog"])

    def on_play(self, now):
        s = self.s
        ranking = self.round_rank()
        got = {}
        if s["rounds"] > 1 or self.RACE:
            k = 0
            for g in ranking:
                pts = PTS[min(k, 3)] if (not self.RACE or all(p in s["done"] or s["prog"][p] > 0 for p in g)) else 0
                for p in g:
                    got[p] = pts
                    s["scores"][p] += pts
                k += len(g)
        else:
            for p in self.ids():
                got[p] = int(s["prog"][p])
                s["scores"][p] = int(s["prog"][p])
        for p in self.ids():
            s["totals"][p] += s["prog"][p]
        s["got"] = got
        if ranking and ranking[0]:
            self.bump("solo_best", ranking[0][0])
        self.go("result", now, 3.6)
        return [{"e": "result", "got": got, "rank": ranking}]

    def on_result(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


def solo(key, name, icon, dur, rounds=1, race=False, rate=40.0, mx=10_000.0, party=True, opts=None):
    """Declare a solo-race minigame in one line."""
    return type(key, (SoloRace,), {"key": key, "name_id": name, "name_en": name, "icon": icon, "DURATION": float(dur),
                                   "ROUNDS": rounds, "RACE": race, "RATE": rate, "MAX": mx, "party_default": party,
                                   "options": opts or [], "party_options": {"rounds": max(1, rounds - 1)} if rounds > 1 else {}})


def rounds_choice(default, choices):
    return [opt("rounds", "Ronde", "Rounds", "select", default, [ch(n, str(n)) for n in choices])]


CoinConveyor = solo("mp_conveyor", "Coin Conveyor", "🧱", 60, rate=60)
ElectricEscape = solo("mp_electric", "Toad-ally Electric Escape", "⚡", 60, race=True, rate=30, mx=100)
BowserFilter = solo("mp_filter", "Bowser Filter", "📧", 40, rate=12)
GoldNBrown = solo("mp_bakery", "Gold 'n Brown", "🥐", 45, rate=20)
NogginKnock = solo("mp_noggin", "Noggin Knock", "🔨", 40, rate=20)
LaneChange = solo("mp_lane", "Lane Change", "🛸", 40, rate=25)
TiltAGolf = solo("mp_golf", "Tilt-a-Golf", "⛳", 45, rounds=3, race=True, rate=40, mx=100, party=False,
                 opts=rounds_choice(3, (1, 3, 5)))
PickaxDash = solo("mp_pickax", "Pickax Dash", "⛏️", 40, race=True, rate=18, mx=100, party=False)
HammerItHome = solo("mp_hammer", "Hammer It Home", "🔩", 45, race=True, rate=6, mx=12)
BowserChicken = solo("mp_chicken", "Bowser Chicken", "🚗", 13, rounds=2, rate=100, mx=100, party=False,
                     opts=rounds_choice(2, (1, 2, 3)))
SpeakUpJunior = solo("mp_junior", "Speak Up, Junior!", "🎤", 17, rounds=2, rate=8, party=False,
                     opts=rounds_choice(2, (1, 2, 3)))
RhythmKitchen = solo("mp_rhythm", "Rhythm Kitchen", "🍳", 42, rate=12)
KongaLine = solo("mp_konga", "DK's Konga Line", "🥁", 44, rate=12)
CameraReady = solo("mp_camera", "Camera-Ready", "📷", 22, rounds=3, rate=100, mx=100, opts=rounds_choice(3, (2, 3, 5)))
StoneEyeBowling = solo("mp_bowling", "Stone-Eye Bowling", "🎳", 50, rate=12, mx=30)
