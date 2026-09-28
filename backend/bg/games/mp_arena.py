"""Server-refereed minigames from the second batch: puzzles (Boss Sumo Bro Blitzers, Hot Cross Blocks,
Shadow Play), live arenas streamed at 20 fps (The Floor Is Falling, Hot-Hot Hop, Stamp Out!, Snag the Flags,
Sunset Standoff), team tapping (Robo Arm Wrestle, Rocky Rope Race) and Slappy-Go-Round."""

from __future__ import annotations

import math

from .base import IllegalMove
from .mario import PTS, Mini, rank_by_score, rounds_opt

F = [{"e": "f"}]  # "frame" event: makes the room send the fresh view to everyone


# ===================================================================================================
# Boss Sumo Bro Blitzers: rotate circuit tiles so the current reaches your platform. Same puzzle for all.
# Tile = set of open sides (0 up, 1 right, 2 down, 3 left); rotation r turns it r×90° clockwise.
SHAPES = {"I": [0, 2], "L": [0, 1], "T": [0, 1, 3], "X": [0, 1, 2, 3]}


def sides(shape, r):
    return {(d + r) % 4 for d in SHAPES[shape]}


class SumoCircuit(Mini):
    key, name_id, name_en, icon = "mp_circuit", "Boss Sumo Bro Blitzers", "Boss Sumo Bro Blitzers", "🔌"
    options = [rounds_opt(3, (2, 3, 5))]
    party_options = {"rounds": 2}
    N = 5

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 3)), tiles=[], rot={}, solved=[], got={})

    def begin(self, now):
        s, r, n = self.s, self.rng, self.N
        s["round"] += 1
        # random path from the left middle to the right middle
        while True:
            path, cur, seen = [(0, n // 2)], (0, n // 2), {(0, n // 2)}
            ok = False
            for _ in range(60):
                x, y = cur
                opts_ = [(x + 1, y)] * 3 + [(x, y - 1), (x, y + 1)]
                opts_ = [c for c in opts_ if 0 <= c[0] < n and 0 <= c[1] < n and c not in seen]
                if not opts_:
                    break
                cur = r.choice(opts_)
                seen.add(cur)
                path.append(cur)
                if cur == (n - 1, n // 2):
                    ok = True
                    break
            if ok and len(path) >= n + 2:
                break
        need = {}
        full = [(-1, n // 2)] + path + [(n, n // 2)]
        for i in range(1, len(full) - 1):
            (px, py), (x, y), (nx, ny) = full[i - 1], full[i], full[i + 1]
            d = set()
            for ax, ay in ((px, py), (nx, ny)):
                d.add(0 if ay < y else 2 if ay > y else 3 if ax < x else 1)
            need[(x, y)] = d
        tiles = []
        for y in range(n):
            for x in range(n):
                if (x, y) in need:
                    d = need[(x, y)]
                    shape = "I" if d in ({0, 2}, {1, 3}) else "L"
                    if r.random() < 0.15:
                        shape = "T"
                else:
                    shape = r.choice(["I", "L", "L", "T"])
                tiles.append(shape)
        s["tiles"] = tiles
        start = [r.randrange(4) for _ in tiles]
        s["rot"] = {p: start[:] for p in self.ids()}
        s["solved"], s["got"] = [], {}
        self.go("play", now, 45.0)
        return [{"e": "round", "n": s["round"]}]

    def connected(self, rot) -> bool:
        n = self.N
        tiles = self.s["tiles"]
        start = (0, n // 2)
        if 3 not in sides(tiles[start[1] * n], rot[start[1] * n]):
            return False
        stack, seen = [start], {start}
        while stack:
            x, y = stack.pop()
            op = sides(tiles[y * n + x], rot[y * n + x])
            if (x, y) == (n - 1, n // 2) and 1 in op:
                return True
            for d, (dx, dy) in ((0, (0, -1)), (1, (1, 0)), (2, (0, 1)), (3, (-1, 0))):
                if d not in op:
                    continue
                nx, ny = x + dx, y + dy
                if not (0 <= nx < n and 0 <= ny < n) or (nx, ny) in seen:
                    continue
                if (d + 2) % 4 in sides(tiles[ny * n + nx], rot[ny * n + nx]):
                    seen.add((nx, ny))
                    stack.append((nx, ny))
        return False

    def view(self, pid):
        s = self.s
        return self.mview(tiles=s["tiles"], mine=s["rot"].get(pid), n=self.N, solved=s["solved"], got=s["got"])

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or pid in s["solved"]:
            raise IllegalMove("Wait.")
        i = int(a.get("i", -1))
        if not 0 <= i < len(s["tiles"]):
            raise IllegalMove("No such tile.")
        s["rot"][pid][i] = (s["rot"][pid][i] + 1) % 4
        if self.connected(s["rot"][pid]):
            s["solved"].append(pid)
            ev = [{"e": "solved", "who": pid, "n": len(s["solved"])}]
            if len(s["solved"]) == len(self.ids()):
                s["deadline"] = min(s["deadline"], now + 1.0)
            return ev
        return [{"e": "rot", "to": pid}]

    def on_play(self, now):
        s = self.s
        s["got"] = self.award_order(s["solved"])
        self.go("result", now, 3.6)
        return [{"e": "zap", "got": s["got"]}]

    def on_result(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


# ===================================================================================================
# Hot Cross Blocks: everyone secretly picks one of 4 block pieces to build a bridge over lava. If two or more
# pick the same piece, nobody gets it. A piece only helps if it starts where your bridge ends.
class HotCrossBlocks(Mini):
    key, name_id, name_en, icon = "mp_blocks", "Hot Cross Blocks", "Hot Cross Blocks", "🟧"
    options = []
    GOAL, COLS = 14, 3

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        return cls.init(players, now, round=0, rounds=0, pos={p: 0 for p in ids}, col={p: 1 for p in ids}, pieces=[],
                        pick={}, result={}, path={p: [] for p in ids}, finished=[])

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        pieces = []
        for _ in range(4):
            a = r.randrange(self.COLS)
            b = max(0, min(self.COLS - 1, a + r.choice((-1, 0, 0, 1))))
            pieces.append({"in": a, "out": b, "len": r.choice((1, 2, 2, 3, 3, 4))})
        s["pieces"], s["pick"], s["result"] = pieces, {}, {}
        self.go("pick", now, 7.0)
        return [{"e": "round", "n": s["round"]}]

    def view(self, pid):
        s = self.s
        show = s["phase"] in ("reveal", "finish")
        return self.mview(pos=s["pos"], col=s["col"], pieces=s["pieces"], mine=s["pick"].get(pid), picked=list(s["pick"]),
                          pick=s["pick"] if show else None, result=s["result"] if show else None, goal=self.GOAL,
                          path=s["path"], finished=s["finished"], rounds=0)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "pick" or pid in s["finished"]:
            raise IllegalMove("Wait.")
        i = int(a.get("i", -1))
        if not 0 <= i < 4:
            raise IllegalMove("Pick a piece.")
        s["pick"][pid] = i
        if all(p in s["pick"] or p in s["finished"] for p in self.ids()):
            s["deadline"] = min(s["deadline"], now + 0.5)
        return [{"e": "picked", "who": pid}]

    def on_pick(self, now):
        s = self.s
        counts = {}
        for i in s["pick"].values():
            counts[i] = counts.get(i, 0) + 1
        res = {}
        for p, i in s["pick"].items():
            pc = s["pieces"][i]
            if counts[i] > 1:
                res[p] = "clash"
            elif pc["in"] != s["col"][p]:
                res[p] = "sink"
            else:
                res[p] = "ok"
                s["path"][p].append([s["pos"][p], pc["in"], pc["out"], pc["len"]])
                s["pos"][p] = min(self.GOAL, s["pos"][p] + pc["len"])
                s["col"][p] = pc["out"]
                s["scores"][p] = s["pos"][p]
                if s["pos"][p] >= self.GOAL and p not in s["finished"]:
                    s["finished"].append(p)
        s["result"] = res
        self.go("reveal", now, 3.2)
        return [{"e": "reveal", "result": res}]

    def on_reveal(self, now):
        s = self.s
        if s["finished"] or s["round"] >= 30:
            first = [p for p in s["finished"]]
            rest = [p for p in self.ids() if p not in first]
            return self.end(now, ([first] if first else []) + rank_by_score(rest, s["pos"]))
        return self.begin(now)


# ===================================================================================================
# Shadow Play: pick one shape from each wheel so that together they cast the shadow shown.
SHADOW_A = ["circle", "square", "triangle", "star", "moon", "heart", "diamond", "bar"]
SHADOW_B = ["dot", "ring", "arrow", "cross", "wave", "bolt", "drop", "crown"]


class ShadowPlay(Mini):
    key, name_id, name_en, icon = "mp_shadow", "Shadow Play", "Shadow Play", "🌘"
    options = [rounds_opt(5, (3, 5, 7))]
    party_options = {"rounds": 4}

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 5)), target=[0, 0], pose={}, tries={},
                        order=[], got={}, place=[0, 0])

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        s["target"] = [r.randrange(8), r.randrange(8)]
        s["place"] = [r.choice((-1, 0, 1)), r.choice((-1, 1))]
        s["tries"], s["order"], s["got"] = {}, [], {}
        self.go("play", now, 20.0)
        return [{"e": "round", "n": s["round"]}]

    def view(self, pid):
        s = self.s
        show = s["phase"] in ("result", "finish")
        return self.mview(target=s["target"], place=s["place"], a=SHADOW_A, b=SHADOW_B, tries=s["tries"].get(pid, 0),
                          solved=s["order"], got=s["got"] if show else None)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or pid in s["order"]:
            raise IllegalMove("Wait.")
        if s["tries"].get(pid, 0) >= 3:
            raise IllegalMove("No tries left this round.")
        pick = [int(a.get("a", -1)), int(a.get("b", -1))]
        s["tries"][pid] = s["tries"].get(pid, 0) + 1
        if pick == s["target"]:
            s["order"].append(pid)
            if len(s["order"]) == len(self.ids()):
                s["deadline"] = min(s["deadline"], now + 0.6)
            return [{"e": "match", "who": pid}]
        return [{"e": "nope", "who": pid, "to": pid}]

    def on_play(self, now):
        s = self.s
        s["got"] = self.award_order(s["order"])
        self.go("result", now, 3.2)
        return [{"e": "result", "got": s["got"]}]

    def on_result(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


# ===================================================================================================
# Live arenas (streamed): positions move on the server 20× a second; every tick emits a frame event.
class Live(Mini):
    def during(self, now):
        s = self.s
        if s["phase"] != "play":
            return []
        dt = min(0.12, now - s.get("tk", now))
        s["tk"] = now
        ev = self.step(now, dt) or []
        return ev + (F if not self.over and s["phase"] == "play" else [])

    def step(self, now, dt) -> list:
        return []

    def last_standing(self, now, alive_key="alive", out_key="out"):
        s = self.s
        ranking = [list(s[alive_key])] if s[alive_key] else []
        for t in sorted(set(s[out_key].values()), reverse=True):
            ranking.append([p for p, x in s[out_key].items() if x == t])
        return self.end(now, [g for g in ranking if g])


class FloorIsFalling(Live):
    key, name_id, name_en, icon = "mp_floor", "The Floor Is Falling", "The Floor Is Falling", "🟫"
    options = []
    N = 6

    @classmethod
    def setup(cls, players, options, rng, now):
        n = cls.N
        spots = [[1, 1], [n - 2, n - 2], [n - 2, 1], [1, n - 2]]
        pos = {p["id"]: spots[i % 4] for i, p in enumerate(players)}
        return cls.init(players, now, pos=pos, alive=[p["id"] for p in players], out={}, warn=[], gone=[], wave=0,
                        next=now + 3.4, stage="calm", stage_t=0.0, cool={}, rounds=0)

    def begin(self, now):
        s = self.s
        s["tk"] = now
        s["next"] = now + 1.2
        self.go("play", now, None)
        return [{"e": "go"}]

    def _pattern(self):
        r, n, k = self.rng, self.N, self.s["wave"]
        kind = r.choice(["rows", "cols", "checker", "random", "ring", "cross"] if k > 2 else ["rows", "cols", "random"])
        cells = []
        for y in range(n):
            for x in range(n):
                if kind == "rows" and y % 2 == k % 2:
                    cells.append(y * n + x)
                elif kind == "cols" and x % 2 == k % 2:
                    cells.append(y * n + x)
                elif kind == "checker" and (x + y) % 2 == k % 2:
                    cells.append(y * n + x)
                elif kind == "ring" and (x in (0, n - 1) or y in (0, n - 1) or (1 < x < n - 2 and 1 < y < n - 2)):
                    cells.append(y * n + x)
                elif kind == "cross" and (x in (n // 2 - 1, n // 2) or y in (n // 2 - 1, n // 2)):
                    cells.append(y * n + x)
        if kind == "random":
            cells = r.sample(range(n * n), int(n * n * min(0.7, 0.45 + k * 0.02)))
        return cells

    def step(self, now, dt):
        s = self.s
        ev = []
        if now >= s["next"]:
            if s["stage"] == "calm":
                s["wave"] += 1
                s["warn"], s["stage"] = self._pattern(), "warn"
                s["next"] = now + max(0.55, 1.2 - s["wave"] * 0.04)
                ev.append({"e": "warn"})
            elif s["stage"] == "warn":
                s["gone"], s["warn"], s["stage"] = s["warn"], [], "fall"
                s["next"] = now + 1.1
                n = self.N
                for p in list(s["alive"]):
                    x, y = s["pos"][p]
                    if y * n + x in s["gone"]:
                        s["alive"].remove(p)
                        s["out"][p] = s["wave"]
                        s["scores"][p] = s["wave"]
                        ev.append({"e": "fall", "who": p})
                ev.append({"e": "drop"})
            else:
                s["gone"], s["stage"] = [], "calm"
                s["next"] = now + max(0.5, 1.3 - s["wave"] * 0.05)
        for p in s["alive"]:
            s["scores"][p] = s["wave"]
        if len(s["alive"]) <= 1 or s["wave"] > 40:
            return ev + self.last_standing(now)
        return ev

    def view(self, pid):
        s = self.s
        return self.mview(n=self.N, pos=s["pos"], alive=s["alive"], warn=s["warn"], gone=s["gone"], wave=s["wave"], rounds=0)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or pid not in s["alive"]:
            return []
        if now < s["cool"].get(pid, 0):
            return []
        d = {"u": (0, -1), "d": (0, 1), "l": (-1, 0), "r": (1, 0)}.get(a.get("d"))
        if not d:
            return []
        x, y = s["pos"][pid]
        nx, ny = max(0, min(self.N - 1, x + d[0])), max(0, min(self.N - 1, y + d[1]))
        if ny * self.N + nx in s["gone"]:
            return []  # can't step into a hole
        s["pos"][pid] = [nx, ny]
        s["cool"][pid] = now + 0.13
        return F


class HotHotHop(Live):
    key, name_id, name_en, icon = "mp_hop", "Hot-Hot Hop", "Hot-Hot Hop", "🔥"
    options = []
    AIR = 0.56

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        ang = {p: round(360 * i / len(ids) + 45, 1) for i, p in enumerate(ids)}
        first = min(ang.values())
        return cls.init(players, now, ang=ang, bars=[round((first - 165) % 360, 1)], w=95.0, dirn=1, alive=ids[:], out={},
                        jump={}, t=0.0, rev_at=now + 12, rounds=0)

    def begin(self, now):
        s = self.s
        s["tk"], s["t"] = now, 0.0
        self.go("play", now, None)
        return [{"e": "go"}]

    def step(self, now, dt):
        s, r = self.s, self.rng
        ev = []
        s["t"] += dt
        s["w"] = min(290.0, 90.0 + s["t"] * 5.0)
        if s["t"] > 26 and len(s["bars"]) == 1:
            s["bars"].append((s["bars"][0] + 180) % 360)
            ev.append({"e": "bar2"})
        if now >= s["rev_at"]:
            s["dirn"] *= -1
            s["rev_at"] = now + r.uniform(5, 10)
            ev.append({"e": "reverse"})
        move = s["w"] * dt * s["dirn"]
        for bi, b in enumerate(s["bars"]):
            nb = (b + move) % 360
            for p in list(s["alive"]):
                a = s["ang"][p]
                # did the bar sweep across the player's angle this tick?
                rel_prev = (a - b) % 360 if s["dirn"] > 0 else (b - a) % 360
                if rel_prev <= abs(move):
                    frac = rel_prev / max(1e-6, abs(move))
                    t_hit = now - dt + frac * dt
                    j = s["jump"].get(p)
                    if not (j is not None and j <= t_hit <= j + self.AIR):
                        s["alive"].remove(p)
                        s["out"][p] = round(s["t"], 2)
                        ev.append({"e": "burn", "who": p})
                    else:
                        self.bump("hops", p)
            s["bars"][bi] = nb
        for p in s["alive"]:
            s["scores"][p] = int(s["t"])
        if len(s["alive"]) <= (0 if len(self.ids()) == 1 else 1) or s["t"] > 90:
            return ev + self.last_standing(now)
        return ev

    def view(self, pid):
        s = self.s
        return self.mview(ang=s["ang"], bars=s["bars"], w=s["w"], dirn=s["dirn"], alive=s["alive"], jump=s["jump"],
                          air=self.AIR, rounds=0)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or pid not in s["alive"]:
            return []
        j = s["jump"].get(pid)
        if j is not None and now < j + self.AIR:
            return []
        t = float(a.get("t", now))
        s["jump"][pid] = min(now, max(now - 0.15, t))  # trust the phone's tap time a little (latency)
        return [{"e": "jump", "who": pid}] + F


class StampOut(Live):
    key, name_id, name_en, icon = "mp_stamp", "Stamp Out!", "Stamp Out!", "🖍️"
    options = []
    N, SPEED, HOP, DUR = 18, 4.2, 0.42, 40.0

    @classmethod
    def setup(cls, players, options, rng, now):
        n = cls.N
        spots = [[3, 3], [n - 3, n - 3], [n - 3, 3], [3, n - 3]]
        pos = {p["id"]: [float(spots[i % 4][0]), float(spots[i % 4][1])] for i, p in enumerate(players)}
        return cls.init(players, now, grid="." * n * n, pos=pos, joy={}, hop={p["id"]: now for p in players},
                        idx={p["id"]: str(i) for i, p in enumerate(players)}, rounds=0)

    def begin(self, now):
        s = self.s
        s["tk"] = now
        self.go("play", now, self.DUR)
        return [{"e": "go"}]

    def step(self, now, dt):
        s, n = self.s, self.N
        g = list(s["grid"])
        changed = False
        for p, (x, y) in s["pos"].items():
            ang, m = s["joy"].get(p, (0, 0))
            if m:
                x = max(0.5, min(n - 0.5, x + math.cos(ang) * self.SPEED * dt * m))
                y = max(0.5, min(n - 0.5, y + math.sin(ang) * self.SPEED * dt * m))
                s["pos"][p] = [round(x, 3), round(y, 3)]
            if now - s["hop"][p] >= self.HOP:
                s["hop"][p] = now
                cx, cy = int(x), int(y)
                for yy in range(cy - 1, cy + 2):
                    for xx in range(cx - 1, cx + 2):
                        if 0 <= xx < n and 0 <= yy < n and (abs(xx - cx) + abs(yy - cy) < 2 or self.rng.random() < 0.5):
                            g[yy * n + xx] = s["idx"][p]
                changed = True
        if changed:
            s["grid"] = "".join(g)
            for p, i in s["idx"].items():
                s["scores"][p] = s["grid"].count(i)
        return []

    def on_play(self, now):
        return self.end(now)

    def view(self, pid):
        s = self.s
        return self.mview(n=self.N, grid=s["grid"], pos=s["pos"], idx=s["idx"], hop=self.HOP)

    def act(self, pid, a, now):
        if self.s["phase"] != "play":
            return []
        self.s["joy"][pid] = (float(a.get("a", 0)), 1 if a.get("m") else 0)
        return []


class SnagTheFlags(Live):
    key, name_id, name_en, icon = "mp_flags", "Snag the Flags", "Snag the Flags", "🚩"
    options = []
    N, SPEED, DUR, COUNT = 20.0, 5.0, 60.0, 40

    @classmethod
    def setup(cls, players, options, rng, now):
        n = cls.N
        flags = []
        while len(flags) < cls.COUNT:
            f = [round(rng.uniform(1, n - 1), 2), round(rng.uniform(1, n - 1), 2)]
            if all((f[0] - g[0]) ** 2 + (f[1] - g[1]) ** 2 > 2.2 for g in flags):
                flags.append(f)
        spots = [[n / 2 - 1.5, n / 2 - 1.5], [n / 2 + 1.5, n / 2 + 1.5], [n / 2 + 1.5, n / 2 - 1.5], [n / 2 - 1.5, n / 2 + 1.5]]
        pos = {p["id"]: spots[i % 4][:] for i, p in enumerate(players)}
        return cls.init(players, now, flags=flags, owner={}, pos=pos, joy={}, rounds=0)

    def begin(self, now):
        self.s["tk"] = now
        self.go("play", now, self.DUR)
        return [{"e": "go"}]

    def step(self, now, dt):
        s, n = self.s, self.N
        ev = []
        for p, (x, y) in s["pos"].items():
            ang, m = s["joy"].get(p, (0, 0))
            if m:
                x = max(0.4, min(n - 0.4, x + math.cos(ang) * self.SPEED * dt))
                y = max(0.4, min(n - 0.4, y + math.sin(ang) * self.SPEED * dt))
                s["pos"][p] = [round(x, 3), round(y, 3)]
            for i, (fx, fy) in enumerate(s["flags"]):
                if str(i) not in s["owner"] and (fx - x) ** 2 + (fy - y) ** 2 < 0.8:
                    s["owner"][str(i)] = p
                    s["scores"][p] += 1
                    ev.append({"e": "snag", "who": p, "i": i})
        if len(s["owner"]) >= len(s["flags"]):
            return ev + self.end(now)
        return ev

    def on_play(self, now):
        return self.end(now)

    def view(self, pid):
        s = self.s
        return self.mview(n=self.N, flags=s["flags"], owner=s["owner"], pos=s["pos"])

    def act(self, pid, a, now):
        if self.s["phase"] != "play":
            return []
        self.s["joy"][pid] = (float(a.get("a", 0)), 1 if a.get("m") else 0)
        return []


class SunsetStandoff(Live):
    """Everyone takes a turn piloting the Bomber Bill (3 runs); the others dodge on the runway."""
    key, name_id, name_en, icon = "mp_sunset", "Sunset Standoff", "Sunset Standoff", "🚀"
    options = []
    W, RUN, RUNS = 10.0, 2.6, 3

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        order = ids[:]
        rng.shuffle(order)
        return cls.init(players, now, order=order, pilot=order[0], run=0, x={p: 5.0 for p in ids}, joy={}, by=0.0,
                        hits=[], rounds=len(ids) * cls.RUNS, round=0)

    def begin(self, now):
        s = self.s
        s["round"] += 1
        k = s["round"] - 1
        s["pilot"] = s["order"][k // self.RUNS]
        spread = [1.5, 3.8, 6.2, 8.5]
        for i, p in enumerate([q for q in self.ids() if q != s["pilot"]]):
            s["x"][p] = spread[i % 4]
        s["x"][s["pilot"]] = self.rng.uniform(2, 8)
        s["by"], s["hits"], s["tk"] = 0.0, [], now
        self.go("aim", now, 1.4)
        return [{"e": "round", "n": s["round"], "pilot": s["pilot"]}]

    def on_aim(self, now):
        self.s["tk"] = now
        self.go("play", now, self.RUN)
        return [{"e": "launch"}]

    def step(self, now, dt):
        s = self.s
        for p in self.ids():
            ang, m = s["joy"].get(p, (0, 0))
            if m:
                sp = 4.6 if p == s["pilot"] else 4.2
                s["x"][p] = max(0.6, min(self.W - 0.6, s["x"][p] + (1 if math.cos(ang) > 0 else -1) * sp * dt))
        s["by"] = min(1.0, (now - s["t0"]) / self.RUN)
        return []

    def on_play(self, now):
        s = self.s
        bx = s["x"][s["pilot"]]
        hits = [p for p in self.ids() if p != s["pilot"] and abs(s["x"][p] - bx) < 1.25]
        s["hits"] = hits
        s["scores"][s["pilot"]] += 2 * len(hits)
        for p in self.ids():
            if p != s["pilot"] and p not in hits:
                s["scores"][p] += 1
        if hits:
            self.bump("bill_hits", s["pilot"], len(hits))
        self.go("boom", now, 2.2)
        return [{"e": "boom", "hits": hits}]

    def on_boom(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)

    def view(self, pid):
        s = self.s
        return self.mview(pilot=s["pilot"], x=s["x"], by=s["by"], hits=s["hits"], w=self.W, order=s["order"], runs=self.RUNS)

    def act(self, pid, a, now):
        if self.s["phase"] not in ("play", "aim"):
            return []
        self.s["joy"][pid] = (float(a.get("a", 0)), 1 if a.get("m") else 0)
        return []


# ===================================================================================================
# Team tapping. Teams: 2 players 1v1, 3 players 1v2 (the solo player counts double), 4 players 2v2.
def make_teams(ids):
    if len(ids) == 4:
        return [[ids[0], ids[2]], [ids[1], ids[3]]]
    if len(ids) == 3:
        return [[ids[0]], [ids[1], ids[2]]]
    return [[i] for i in ids]


class RoboArmWrestle(Live):
    key, name_id, name_en, icon = "mp_arm", "Robo Arm Wrestle", "Robo Arm Wrestle", "🦾"
    options = []
    party_options = {}
    TIME = 15.0

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        return cls.init(players, now, teams=make_teams(ids), p=0.0, taps={}, wins=[0, 0], round=0, rounds=3, last=None)

    def begin(self, now):
        s = self.s
        s["round"] += 1
        s["p"], s["taps"], s["tk"], s["last"] = 0.0, {}, now, None
        self.go("play", now, self.TIME)
        return [{"e": "round", "n": s["round"]}]

    def weight(self, team):
        return 2.0 if len(team) == 1 and len(self.ids()) == 3 else 1.0

    def step(self, now, dt):
        s = self.s
        if abs(s["p"]) >= 1:
            return self._win(now, 0 if s["p"] < 0 else 1)
        return []

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play":
            return []
        n = max(0, min(int(a.get("n", 1)), 6))
        team = 0 if pid in s["teams"][0] else 1
        w = self.weight(s["teams"][team]) / max(1, len(self.ids()) / 2) * 0.025
        s["p"] += (-1 if team == 0 else 1) * n * w
        s["taps"][pid] = s["taps"].get(pid, 0) + n
        return []

    def _win(self, now, team):
        s = self.s
        s["wins"][team] += 1
        s["last"] = team
        for p in s["teams"][team]:
            s["scores"][p] = s["wins"][team]
        self.go("slam", now, 3.0)
        return [{"e": "slam", "team": team}]

    def on_play(self, now):
        s = self.s
        return self._win(now, 0 if s["p"] < 0 else 1)

    def on_slam(self, now):
        s = self.s
        if max(s["wins"]) >= 2 or s["round"] >= 3:
            w = 0 if s["wins"][0] > s["wins"][1] else 1
            return self.end(now, [s["teams"][w], s["teams"][1 - w]])
        return self.begin(now)

    def view(self, pid):
        s = self.s
        return self.mview(teams=s["teams"], p=s["p"], wins=s["wins"], last=s["last"], taps=s["taps"])


class RockyRopeRace(Live):
    key, name_id, name_en, icon = "mp_rope", "Rocky Rope Race", "Rocky Rope Race", "🧗"
    options = []
    BARS = 24

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        teams = make_teams(ids) if len(ids) == 4 else [[i] for i in ids]
        return cls.init(players, now, teams=teams, bar=[0] * len(teams), expect=[None] * len(teams), stun=[0.0] * len(teams),
                        done=[], rounds=0)

    def begin(self, now):
        self.s["tk"] = now
        self.go("play", now, 60.0)
        return [{"e": "go"}]

    def team_of(self, pid):
        return next(i for i, t in enumerate(self.s["teams"]) if pid in t)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play":
            return []
        t = self.team_of(pid)
        if t in s["done"] or now < s["stun"][t]:
            return []
        team = s["teams"][t]
        who = a.get("h") if len(team) == 1 else pid   # solo: alternate hands L/R; pairs: alternate players
        if who not in (("L", "R") if len(team) == 1 else team):
            return []
        if s["expect"][t] is not None and who == s["expect"][t]:
            # same hand / same player twice: you slip and fall a little
            s["bar"][t] = max(0, s["bar"][t] - 2)
            s["stun"][t] = now + 0.9
            s["expect"][t] = None
            self.bump("slips", pid)
            return [{"e": "slip", "team": t}] + F
        s["expect"][t] = who
        s["bar"][t] += 1
        for p in team:
            s["scores"][p] = s["bar"][t]
        ev = [{"e": "grab", "team": t}]
        if s["bar"][t] >= self.BARS:
            s["done"].append(t)
            ev.append({"e": "top", "team": t})
            if len(s["done"]) >= len(s["teams"]) - 1:
                s["deadline"] = min(s["deadline"], now + 0.8)
        return ev + F

    def on_play(self, now):
        s = self.s
        order = [s["teams"][t] for t in s["done"]]
        rest = sorted([t for t in range(len(s["teams"])) if t not in s["done"]], key=lambda t: -s["bar"][t])
        groups: dict[int, list] = {}
        for t in rest:
            groups.setdefault(s["bar"][t], []).extend(s["teams"][t])
        return self.end(now, order + [groups[b] for b in sorted(groups, reverse=True)])

    def view(self, pid):
        s = self.s
        return self.mview(teams=s["teams"], bar=s["bar"], expect=s["expect"], stun=s["stun"], bars=self.BARS, done=s["done"])


# ===================================================================================================
# Slappy-Go-Round: press SLAP to send the big hand around the circle. Everyone else must jump over it.
# If everybody clears it, it comes back and slaps whoever sent it! 5 slaps and you're out.
class SlappyGoRound(Live):
    key, name_id, name_en, icon = "mp_slappy", "Slappy-Go-Round", "Slappy-Go-Round", "🖐️"
    options = []
    LAP, AIR, HP, COOL = 2.2, 0.5, 5, 1.6

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        ang = {p: round(360 * i / len(ids), 1) for i, p in enumerate(ids)}
        return cls.init(players, now, ang=ang, dmg={p: 0 for p in ids}, alive=ids[:], out={}, hand=None, jump={},
                        cool={}, rounds=0)

    def begin(self, now):
        self.s["tk"] = now
        self.go("play", now, 60.0)
        return [{"e": "go"}]

    def _hurt(self, p, now, ev):
        s = self.s
        s["dmg"][p] += 1
        ev.append({"e": "slap", "who": p})
        if s["dmg"][p] >= self.HP and p in s["alive"]:
            s["alive"].remove(p)
            s["out"][p] = round(now, 2)

    def step(self, now, dt):
        s = self.s
        ev = []
        h = s["hand"]
        if h:
            prog_prev = h["prog"]
            h["prog"] = min(1.0, (now - h["t"]) / self.LAP)
            a0 = s["ang"][h["by"]]
            for p in list(s["alive"]):
                if p == h["by"] or p in h["passed"]:
                    continue
                rel = ((s["ang"][p] - a0) % 360) / 360
                if prog_prev < rel <= h["prog"]:
                    h["passed"].append(p)
                    t_hit = h["t"] + rel * self.LAP
                    j = s["jump"].get(p)
                    if j is not None and j <= t_hit <= j + self.AIR:
                        h["cleared"].append(p)
                        self.bump("hops", p)
                    else:
                        self._hurt(p, now, ev)
            if h["prog"] >= 1.0:
                others = [p for p in s["alive"] if p != h["by"]]
                if others and all(p in h["cleared"] for p in others) and h["by"] in s["alive"]:
                    self._hurt(h["by"], now, ev)
                    ev.append({"e": "backfire", "who": h["by"]})
                s["hand"] = None
        for p in self.ids():
            s["scores"][p] = self.HP - s["dmg"][p]
        if len(s["alive"]) <= 1:
            return ev + self.last_standing(now)
        return ev

    def on_play(self, now):
        s = self.s
        return self.end(now, rank_by_score([p for p in self.ids()], {p: -s["dmg"][p] + (100 if p in s["alive"] else 0) for p in self.ids()}))

    def view(self, pid):
        s = self.s
        return self.mview(ang=s["ang"], dmg=s["dmg"], hp=self.HP, alive=s["alive"], hand=s["hand"], jump=s["jump"],
                          cool=s["cool"], air=self.AIR, lap=self.LAP)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or pid not in s["alive"]:
            return []
        if a.get("do") == "slap":
            if s["hand"] or now < s["cool"].get(pid, 0):
                return []
            s["hand"] = {"by": pid, "t": now, "prog": 0.0, "passed": [], "cleared": []}
            s["cool"][pid] = now + self.LAP + self.COOL
            return [{"e": "spin", "who": pid}] + F
        j = s["jump"].get(pid)
        if j is not None and now < j + self.AIR + 0.15:
            return []
        t = float(a.get("t", now))
        s["jump"][pid] = min(now, max(now - 0.15, t))
        return [{"e": "jump", "who": pid}] + F


_ = PTS
