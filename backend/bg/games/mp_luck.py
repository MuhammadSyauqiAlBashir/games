"""Mind-game minigames: Sleight of Shell, Tricky Turntable, Lost and Pound."""

from __future__ import annotations

from .base import IllegalMove
from .mario import Mini, rounds_opt


# ---------------------------------------------------------------------------------------------------
# Sleight of Shell: Bowser hides Bob-ombs in chests and shuffles them; pick a safe chest or you're out.
class SleightOfShell(Mini):
    key, name_id, name_en, icon = "mp_shell", "Sleight of Shell", "Sleight of Shell", "🎁"
    options = []
    MAX_ROUNDS = 7

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=cls.MAX_ROUNDS, alive=[p["id"] for p in players], out={},
                        bombs=[], moves=[], final=[0, 1, 2], picks={}, show=0.0, boom=[])

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        k = s["round"]
        nb = 1 if k < 3 else 2
        s["bombs"] = r.sample(range(3), nb)  # chest ids
        slot = [0, 1, 2]  # slot of chest i
        moves = []
        t = 2.4  # after the bombs are shown and lids close
        count = min(12, 4 + k * 2)
        dur = max(0.24, 0.62 - k * 0.07)
        for j in range(count):
            if k == 2 or (k >= 4 and r.random() < 0.35):
                step = r.choice((1, -1))
                moves.append({"k": "spin", "dir": step, "t": round(t, 2), "d": round(dur * 1.2, 2)})
                slot = [(x + step) % 3 for x in slot]
                t += dur * 1.2 + 0.05
            else:
                a, b = r.sample(range(3), 2)
                moves.append({"k": "swap", "a": a, "b": b, "t": round(t, 2), "d": round(dur, 2)})
                slot = [b if x == a else a if x == b else x for x in slot]
                t += dur + r.uniform(0.03, 0.12)
        s["moves"], s["final"] = moves, slot
        s["show"] = round(t + 0.3, 2)
        s["picks"], s["boom"] = {}, []
        self.go("show", now, s["show"])
        return [{"e": "round", "n": k, "bombs": nb}]

    def view(self, pid):
        s = self.s
        reveal = s["phase"] in ("reveal", "finish")
        return self.mview(rounds=0, bombs=s["bombs"], moves=s["moves"], show=s["show"], alive=s["alive"], out=s["out"],
                          final=s["final"] if reveal else None, mine=s["picks"].get(pid), picked=list(s["picks"]),
                          picks=s["picks"] if reveal else None, boom=s["boom"])

    def on_show(self, now):
        self.go("pick", now, 6.0)
        return [{"e": "pick"}]

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "pick":
            raise IllegalMove("Watch the chests!")
        if pid not in s["alive"]:
            raise IllegalMove("You're out — cheer the others on!")
        if pid in s["picks"]:
            raise IllegalMove("Already chosen.")
        i = int(a.get("slot", -1))
        if i not in (0, 1, 2):
            raise IllegalMove("Pick a chest.")
        s["picks"][pid] = i
        if all(p in s["picks"] for p in s["alive"]):
            s["deadline"] = min(s["deadline"], now + 0.3)
        return [{"e": "picked", "who": pid}]

    def on_pick(self, now):
        s, r = self.s, self.rng
        for p in s["alive"]:
            s["picks"].setdefault(p, r.randrange(3))
        bomb_slots = {s["final"][b] for b in s["bombs"]}
        boom = [p for p in s["alive"] if s["picks"][p] in bomb_slots]
        if len(boom) == len(s["alive"]):
            boom_real = []  # everyone picked a bomb: all survive this round (a Bowser "rematch")
        else:
            boom_real = boom
        for p in boom_real:
            s["out"][p] = s["round"]
            self.bump("boomed", p)
        s["alive"] = [p for p in s["alive"] if p not in boom_real]
        for p in s["alive"]:
            s["scores"][p] = s["round"]
        s["boom"] = boom
        self.go("reveal", now, 3.6)
        return [{"e": "reveal", "boom": boom, "saved": len(boom) == len(s["picks"]) and bool(boom)}]

    def on_reveal(self, now):
        s = self.s
        if len(s["alive"]) <= 1 or s["round"] >= s["rounds"]:
            ranking = [list(s["alive"])] if s["alive"] else []
            for rnd in sorted(set(s["out"].values()), reverse=True):
                ranking.append([p for p, x in s["out"].items() if x == rnd])
            return self.end(now, [g for g in ranking if g])
        return self.begin(now)


# ---------------------------------------------------------------------------------------------------
# Tricky Turntable: everyone secretly presses (or not); each press turns the cog 90° clockwise.
# You get whatever lands in front of you: coins or a Bob-omb.
SIDES = {2: [3, 1], 3: [3, 0, 1], 4: [3, 0, 1, 2]}  # platform index: 0 top, 1 right, 2 bottom, 3 left


class TrickyTurntable(Mini):
    key, name_id, name_en, icon = "mp_turntable", "Tricky Turntable", "Tricky Turntable", "⚙️"
    options = [rounds_opt(7, (5, 7, 9))]
    party_options = {"rounds": 5}
    BOMB = -2

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        side = dict(zip(ids, SIDES[len(ids)]))
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 7)), side=side,
                        buttons=2 if len(ids) == 2 else 1, items=[], press={}, locked=[], turn=0, got={}, rot=0)

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        sets = [[1, 2, 3, "B"], [5, 1, "B", "B"], [3, 3, 1, "B"], [2, 2, 5, "B"], [1, 5, 3, 2], [5, "B", "B", "B"]]
        items = list(r.choice(sets[:5] if s["round"] < s["rounds"] else sets))
        r.shuffle(items)
        s["items"], s["press"], s["locked"], s["got"] = items, {p: [False] * s["buttons"] for p in self.ids()}, [], {}
        self.go("choose", now, 9.0)
        return [{"e": "round", "n": s["round"]}]

    def view(self, pid):
        s = self.s
        reveal = s["phase"] in ("reveal", "finish")
        return self.mview(side=s["side"], buttons=s["buttons"], items=s["items"], mine=s["press"].get(pid),
                          locked=s["locked"], rot=s["rot"] if reveal else None, press=s["press"] if reveal else None,
                          got=s["got"] if reveal else None)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "choose":
            raise IllegalMove("Wait for the next round.")
        if pid in s["locked"]:
            raise IllegalMove("Already locked in.")
        if a.get("do") == "lock":
            s["locked"].append(pid)
            if len(s["locked"]) == len(self.ids()):
                s["deadline"] = min(s["deadline"], now + 0.4)
            return [{"e": "locked", "who": pid}]
        b = int(a.get("b", -1))
        if not 0 <= b < s["buttons"]:
            raise IllegalMove("No such button.")
        s["press"][pid][b] = not s["press"][pid][b]
        return []

    def on_choose(self, now):
        s = self.s
        k = sum(sum(1 for x in v if x) for v in s["press"].values()) % 4
        s["rot"] = k
        got = {}
        for pid, side in s["side"].items():
            item = s["items"][(side - k) % 4]
            val = self.BOMB if item == "B" else item
            s["scores"][pid] = max(0, s["scores"][pid] + val)
            got[pid] = item
            if item == "B":
                self.bump("bombs", pid)
        s["got"] = got
        self.go("reveal", now, 4.2)
        return [{"e": "reveal", "rot": k, "got": got}]

    def on_reveal(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


# ---------------------------------------------------------------------------------------------------
# Lost and Pound: one player hides in a hole, the others pick where the hammer strikes.
# Everyone takes a turn hiding (3 rounds each). Dodge = +3 for the hider, hit = +1 per striker on target.
class LostAndPound(Mini):
    key, name_id, name_en, icon = "mp_pound", "Lost and Pound", "Lost and Pound", "🔨"
    options = []
    PER = 3

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        order = ids[:]
        rng.shuffle(order)
        return cls.init(players, now, round=0, rounds=len(ids) * cls.PER, order=order, holes=3 if len(ids) == 2 else 4,
                        hider=order[0], lives=3, hide=None, strikes={}, result=None)

    def begin(self, now):
        s = self.s
        s["round"] += 1
        turn = (s["round"] - 1) // self.PER
        new = s["order"][turn]
        if new != s["hider"] or s["round"] == 1:
            s["lives"] = 3
        s["hider"] = new
        s["hide"], s["strikes"], s["result"] = None, {}, None
        self.go("choose", now, 7.0)
        return [{"e": "round", "n": s["round"], "hider": new}]

    def view(self, pid):
        s = self.s
        reveal = s["phase"] in ("reveal", "finish")
        striker = pid and pid != s["hider"]
        return self.mview(hider=s["hider"], holes=s["holes"], lives=s["lives"], order=s["order"], per=self.PER,
                          hide=s["hide"] if (reveal or pid == s["hider"]) else None,
                          strikes=s["strikes"] if (reveal or striker) else {k: None for k in s["strikes"]},
                          result=s["result"])

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "choose":
            raise IllegalMove("Wait for the next round.")
        h = int(a.get("hole", -1))
        if not 0 <= h < s["holes"]:
            raise IllegalMove("Pick a hole.")
        if pid == s["hider"]:
            s["hide"] = h
        else:
            s["strikes"][pid] = h
        if s["hide"] is not None and len(s["strikes"]) == len(self.ids()) - 1 and a.get("final", True):
            s["deadline"] = min(s["deadline"], now + 1.2)
        return [{"e": "chose", "who": pid}]

    def on_choose(self, now):
        s, r = self.s, self.rng
        if s["hide"] is None:
            s["hide"] = r.randrange(s["holes"])
        for p in self.ids():
            if p != s["hider"] and p not in s["strikes"]:
                s["strikes"][p] = r.randrange(s["holes"])
        hitters = [p for p, h in s["strikes"].items() if h == s["hide"]]
        if hitters:
            s["lives"] -= 1
            for p in hitters:
                s["scores"][p] += 1
                self.bump("pounds", p)
        else:
            s["scores"][s["hider"]] += 3
            self.bump("dodges", s["hider"])
        s["result"] = {"hit": bool(hitters), "hitters": hitters}
        self.go("reveal", now, 3.6)
        return [{"e": "reveal", **s["result"]}]

    def on_reveal(self, now):
        s = self.s
        if s["round"] >= s["rounds"]:
            return self.end(now)
        # A hider hit 3 times ends their turn early.
        if s["lives"] <= 0:
            turn = (s["round"] - 1) // self.PER
            s["round"] = (turn + 1) * self.PER
            if s["round"] >= s["rounds"]:
                return self.end(now)
        return self.begin(now)
