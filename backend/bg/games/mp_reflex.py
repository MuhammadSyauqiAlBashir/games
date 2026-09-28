"""Timing & reflex minigames: Sled to the Edge, Fast Fishing, Talking Flower Says, Knock-Knock Match."""

from __future__ import annotations

from .base import IllegalMove
from .mario import PTS, Mini, rank_by_score, rounds_opt


# ---------------------------------------------------------------------------------------------------
# Sled to the Edge: a Cooligan pulls your sled faster and faster; let go so you stop closest to the edge.
class SledToTheEdge(Mini):
    key, name_id, name_en, icon = "mp_sled", "Sled to the Edge", "Sled to the Edge", "🛷"
    options = [rounds_opt(3, (1, 3, 5))]
    party_options = {"rounds": 2}
    T_MAX = 6.5
    READY = 2.6

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 3)), ice={}, rel={}, dist={}, got={})

    @staticmethod
    def travel(ice, t):
        """Distance (m) where a sled released after t seconds of pulling stops, and the slide time."""
        a, mu = ice["a"], ice["mu"]
        v = a * t
        return 0.5 * a * t * t + v * v / (2 * mu), v / mu

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        kind = r.choice(["licin", "normal", "kasar"])
        mu = {"licin": 5.5, "normal": 7.5, "kasar": 10.0}[kind] * r.uniform(0.93, 1.07)
        s["ice"] = {"a": round(r.uniform(5.0, 7.0), 2), "mu": round(mu, 2), "kind": kind, "edge": r.randint(80, 125)}
        s["rel"], s["dist"], s["got"] = {}, {}, {}
        self.go("ready", now, self.READY)
        return [{"e": "round", "n": s["round"]}]

    def on_ready(self, now):
        self.go("pull", now, self.T_MAX)
        return [{"e": "pull"}]

    def view(self, pid):
        s = self.s
        return self.mview(ice=s["ice"], rel=s["rel"], dist=s["dist"] if s["phase"] in ("result", "finish") else None,
                          got=s["got"], t_max=self.T_MAX)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "pull":
            raise IllegalMove("Not yet!")
        if pid in s["rel"]:
            return []
        t_client = float(a.get("t", now))
        t = min(now, max(s["t0"], t_client)) - s["t0"]
        s["rel"][pid] = round(min(self.T_MAX, t), 3)
        ev = [{"e": "release", "who": pid, "t": s["rel"][pid]}]
        if len(s["rel"]) == len(self.ids()):
            ends = [self.travel(s["ice"], x)[1] + x for x in s["rel"].values()]
            s["deadline"] = s["t0"] + max(ends) + 0.8
            s["phase"] = "slide"
        return ev

    def _score(self, now):
        s = self.s
        edge = s["ice"]["edge"]
        for p in self.ids():
            if p in s["rel"]:
                d, _ = self.travel(s["ice"], s["rel"][p])
                s["dist"][p] = round(edge - d, 1)  # meters left before the edge; < 0 = fell in
            else:
                s["dist"][p] = -999
        safe = sorted([p for p in self.ids() if s["dist"][p] >= 0], key=lambda p: s["dist"][p])
        got, k = {}, 0
        for i, p in enumerate(safe):
            if i and s["dist"][p] != s["dist"][safe[i - 1]]:
                k = i
            got[p] = PTS[min(k, 3)]
            s["scores"][p] += got[p]
        for p in self.ids():
            if s["dist"][p] < 0:
                self.bump("splash", p)
        if safe:
            self.bump("closest", safe[0])
        s["got"] = got
        self.go("result", now, 4.0)
        return [{"e": "result", "dist": s["dist"], "got": got}]

    def on_pull(self, now):
        # Time's up: whoever didn't let go gets dragged into the water. Wait for the slides to finish.
        s = self.s
        ends = [self.travel(s["ice"], x)[1] + x for x in s["rel"].values()] or [0]
        s["phase"], s["deadline"] = "slide", s["t0"] + max(max(ends), self.T_MAX + 1.4) + 0.6
        return [{"e": "timeout"}]

    def on_slide(self, now):
        return self._score(now)

    def on_result(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


# ---------------------------------------------------------------------------------------------------
# Fast Fishing: reel in the moment the float sinks. Too early and the line snaps (tin can!).
class FastFishing(Mini):
    key, name_id, name_en, icon = "mp_fish", "Fast Fishing", "Fast Fishing", "🎣"
    options = [rounds_opt(3, (2, 3, 5))]   # wins needed
    party_options = {"rounds": 2}
    WINDOW = 2.2

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 3)), wins={p["id"]: 0 for p in players},
                        plan=[], sink=None, nibbles=0, early=[], rt={}, winner=None)

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        wait = r.uniform(2.2, 7.0)
        nib = sorted(r.uniform(0.8, wait - 0.5) for _ in range(r.choice((0, 1, 2, 2, 3)))) if wait > 1.5 else []
        s["plan"] = {"sink": round(now + 1.6 + wait, 3), "nib": [round(now + 1.6 + x, 3) for x in nib]}
        s["sink"], s["nibbles"], s["early"], s["rt"], s["winner"] = None, 0, [], {}, None
        self.go("wait", now, None)
        return [{"e": "cast", "n": s["round"]}]

    def during(self, now):
        s = self.s
        if s["phase"] != "wait":
            return []
        ev = []
        while s["nibbles"] < len(s["plan"]["nib"]) and now >= s["plan"]["nib"][s["nibbles"]]:
            s["nibbles"] += 1
            ev.append({"e": "nibble"})
        if now >= s["plan"]["sink"]:
            s["sink"] = now
            self.go("bite", now, self.WINDOW)
            ev.append({"e": "sink"})
        return ev

    def view(self, pid):
        s = self.s
        return self.mview(wins=s["wins"], need=s["rounds"], nibbles=s["nibbles"], sink=s["sink"], early=s["early"],
                          reeled=list(s["rt"]), rt=s["rt"] if s["phase"] in ("result", "finish") else None,
                          winner=s["winner"])

    def act(self, pid, a, now):
        s = self.s
        if pid in s["early"] or pid in s["rt"]:
            return []
        if s["phase"] == "wait":
            s["early"].append(pid)
            self.bump("snapped", pid)
            ev = [{"e": "early", "who": pid}]
            if len(s["early"]) == len(self.ids()):
                s["winner"] = None
                ev += self._result(now)
            return ev
        if s["phase"] != "bite":
            raise IllegalMove("Wait for the next cast.")
        elapsed = now - s["sink"]
        rt = float(a.get("rt", elapsed))
        rt = max(0.1, min(rt, elapsed + 0.25, self.WINDOW))
        s["rt"][pid] = round(rt, 3)
        if len(s["rt"]) + len(s["early"]) == len(self.ids()):
            s["deadline"] = min(s["deadline"], now + 0.15)
        return [{"e": "reel", "who": pid}]

    def on_bite(self, now):
        return self._result(now)

    def _result(self, now):
        s = self.s
        if s["rt"]:
            w = min(s["rt"], key=s["rt"].get)
            s["winner"] = w
            s["wins"][w] += 1
            s["scores"][w] = s["wins"][w]
            best = s.setdefault("stats", {}).setdefault("reaction", {})
            best[w] = min(best.get(w, 9), s["rt"][w])
        self.go("result", now, 3.2)
        return [{"e": "catch", "who": s["winner"], "rt": s["rt"]}]

    def on_result(self, now):
        s = self.s
        top = max(s["wins"].values())
        if top >= s["rounds"] or s["round"] >= s["rounds"] * 2 + 1:
            return self.end(now, rank_by_score(self.ids(), s["wins"]))
        return self.begin(now)


# ---------------------------------------------------------------------------------------------------
# Talking Flower Says: red caps and green caps; stand or squat exactly as told. Don't move if the
# order isn't for your cap! Three mistakes and you're out.
class TalkingFlowerSays(Mini):
    key, name_id, name_en, icon = "mp_flower", "Talking Flower Says", "Talking Flower Says", "🌺"
    options = []
    MAX_CMDS = 22

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        caps = {pid: ("red" if i % 2 == 0 else "green") for i, pid in enumerate(ids)}
        return cls.init(players, now, round=0, rounds=cls.MAX_CMDS, caps=caps, pose={p: "stand" for p in ids},
                        prev={}, hearts={p: 3 for p in ids}, alive=ids[:], cmd=None, miss=[], out_at={})

    def begin(self, now):
        return self.next_cmd(now)

    def next_cmd(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        k = s["round"]
        caps_alive = {s["caps"][p] for p in s["alive"]}
        if k > 3 and r.random() < 0.12 and len(self.ids()) > 1:
            cmd = {"kind": "swap"}
            window = 2.2
        else:
            target = r.choice(["all"] + sorted(caps_alive) * 2)
            pose = r.choice(["stand", "squat"])
            neg = k > 2 and r.random() < 0.35
            cmd = {"kind": "pose", "target": target, "pose": pose, "neg": neg}
            window = max(1.35, 3.1 - k * 0.09)
        s["cmd"] = cmd
        s["prev"] = dict(s["pose"])
        s["miss"] = []
        self.go("cmd", now, window)
        return [{"e": "cmd", **cmd}]

    def view(self, pid):
        s = self.s
        return self.mview(caps=s["caps"], pose=s["pose"], hearts=s["hearts"], alive=s["alive"], cmd=s["cmd"],
                          miss=s["miss"], rounds=0)

    def act(self, pid, a, now):
        s = self.s
        if pid not in s["alive"]:
            raise IllegalMove("You're out — watch the others!")
        pose = a.get("pose")
        if pose not in ("stand", "squat"):
            raise IllegalMove("Stand or squat.")
        if s["phase"] not in ("cmd", "judge", "start"):
            return []
        s["pose"][pid] = pose
        return [{"e": "pose", "who": pid, "pose": pose}]

    def on_cmd(self, now):
        s = self.s
        cmd = s["cmd"]
        miss = []
        if cmd["kind"] == "swap":
            for p in s["caps"]:
                s["caps"][p] = "green" if s["caps"][p] == "red" else "red"
        else:
            want = cmd["pose"] if not cmd["neg"] else ("squat" if cmd["pose"] == "stand" else "stand")
            for p in s["alive"]:
                targeted = cmd["target"] == "all" or s["caps"][p] == cmd["target"]
                ok = s["pose"][p] == want if targeted else s["pose"][p] == s["prev"].get(p, s["pose"][p])
                if not ok:
                    miss.append(p)
        for p in miss:
            s["hearts"][p] -= 1
            self.bump("oops", p)
            if s["hearts"][p] <= 0:
                s["alive"].remove(p)
                s["out_at"][p] = s["round"]
        for p in s["alive"]:
            s["scores"][p] += 1
        s["miss"] = miss
        self.go("judge", now, 1.6)
        return [{"e": "judge", "miss": miss}]

    def on_judge(self, now):
        s = self.s
        if len(s["alive"]) <= 1 or s["round"] >= s["rounds"]:
            ranking = []
            alive = sorted(s["alive"], key=lambda p: -s["hearts"][p])
            groups: dict[int, list] = {}
            for p in alive:
                groups.setdefault(s["hearts"][p], []).append(p)
            ranking += [groups[h] for h in sorted(groups, reverse=True)]
            for rnd in sorted(set(s["out_at"].values()), reverse=True):
                ranking.append([p for p, x in s["out_at"].items() if x == rnd])
            return self.end(now, ranking)
        return self.next_cmd(now)


# ---------------------------------------------------------------------------------------------------
# Knock-Knock Match: knock on two doors; matching characters = keep them and knock again.
CHARS = ["🍄", "⭐", "🐢", "👻", "💣", "🌸", "🦖", "👑", "🔥", "🪙"]


class KnockKnockMatch(Mini):
    key, name_id, name_en, icon = "mp_memory", "Knock-Knock Match", "Knock-Knock Match", "🚪"
    options = []
    PICK = 10.0

    @classmethod
    def setup(cls, players, options, rng, now):
        pairs = 6 if len(players) == 2 else 8
        chars = rng.sample(CHARS, pairs) * 2
        rng.shuffle(chars)
        order = [p["id"] for p in players]
        rng.shuffle(order)
        return cls.init(players, now, doors=chars, found={}, open=[], order=order, turn=order[0], pairs=pairs)

    def begin(self, now):
        self.go("pick", now, self.PICK)
        return [{"e": "turn", "who": self.s["turn"]}]

    def turn(self):
        return [self.s["turn"]] if self.s["phase"] == "pick" and not self.over else []

    def view(self, pid):
        s = self.s
        shown = {str(i): s["doors"][i] for i in s["open"]}
        shown.update({str(i): s["doors"][i] for i in map(int, s["found"])})
        return self.mview(n=len(s["doors"]), found=s["found"], open=s["open"], shown=shown, order=s["order"], pairs=s["pairs"])

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "pick" or pid != s["turn"]:
            raise IllegalMove("Not your turn.")
        return self._knock(int(a.get("door", -1)), now)

    def _knock(self, i, now):
        s = self.s
        if not 0 <= i < len(s["doors"]) or str(i) in s["found"] or i in s["open"]:
            raise IllegalMove("Knock on a closed door.")
        s["open"].append(i)
        ev = [{"e": "knock", "door": i, "who": s["turn"], "char": s["doors"][i]}]
        if len(s["open"]) < 2:
            self.go("pick", now, self.PICK)
            return ev
        a, b = s["open"]
        if s["doors"][a] == s["doors"][b]:
            s["found"][str(a)] = s["found"][str(b)] = s["turn"]
            s["scores"][s["turn"]] += 1
            self.bump("pairs", s["turn"])
            s["open"] = []
            ev.append({"e": "match", "who": s["turn"], "char": s["doors"][a]})
            if len(s["found"]) == len(s["doors"]):
                return ev + self.end(now)
            self.go("pick", now, self.PICK)
            return ev
        ev.append({"e": "miss", "who": s["turn"]})
        self.go("miss", now, 1.6)
        return ev

    def on_pick(self, now):
        s = self.s
        closed = [i for i in range(len(s["doors"])) if str(i) not in s["found"] and i not in s["open"]]
        return self._knock(self.rng.choice(closed), now)

    def on_miss(self, now):
        s = self.s
        s["open"] = []
        order = [p for p in s["order"] if p in self.ids()]
        s["turn"] = order[(order.index(s["turn"]) + 1) % len(order)]
        self.go("pick", now, self.PICK)
        return [{"e": "turn", "who": s["turn"]}]
