"""Snake arena (slither.io style), last snake alive.

The server simulates the arena 20 times a second. Players steer with an angle and can
boost (faster, but you shrink). Eat pellets to grow. Hitting another snake's body or
the arena edge kills you and turns your body into food. Computer snakes keep the
arena lively; the safe circle shrinks over time so a round always ends. The last
human player alive wins (computer snakes don't count).

Network: every frame sends each snake's head, angle and length; the browser draws the
bodies from the head path. Full snapshots are sent to anyone joining or reconnecting."""

from __future__ import annotations

import math

from .base import Game, ch, opt

HZ = 20
SPEED, BOOST = 7.0, 12.5
TURN = 0.22
START_LEN = 24
MIN_LEN = 12
ARENA = 1100.0
FOOD_TARGET = 160
CELL = 48
BOT_COLORS = ["#9aa5b1", "#b5a48b", "#8fae9b", "#a79bb8", "#c2a1a1", "#9fb3c8", "#b8b28f", "#a5b5a0", "#c0a8c8", "#8fa7a6"]
BOT_NAMES = ["Bot Lele", "Bot Cacing", "Bot Belut", "Bot Sanca", "Bot Kobra", "Bot Piton", "Bot Welang", "Bot Viper",
             "Bot Mamba", "Bot Boa"]


class Snake(Game):
    key, name_id, name_en, icon = "snake", "Arena Ular", "Snake arena", "🐍"
    kind = "realtime"
    tick_hz = HZ
    min_players, max_players = 2, 6
    options = [
        opt("bots", "Ular komputer", "Computer snakes", "select", 6, [ch(n, str(n)) for n in (0, 3, 6, 8, 10)]),
        opt("bot_level", "Kepintaran komputer", "Computer skill", "select", 2, [ch(1, "Santai", "Easy"), ch(2, "Normal"), ch(3, "Ganas", "Fierce")]),
        opt("minutes", "Arena menyempit dalam", "Arena shrinks over", "select", 3, [ch(n, f"{n} menit", f"{n} min") for n in (2, 3, 5)]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        snakes = {}
        n_h = len(players)
        n_b = int(options.get("bots", 6))
        total = n_h + n_b
        for i, p in enumerate(players):
            snakes[p["id"]] = cls._spawn(i, total, p["name"], p.get("color") or "#c8453a", False, rng)
        for j in range(n_b):
            bid = f"bot{j}"
            snakes[bid] = cls._spawn(n_h + j, total, BOT_NAMES[j % len(BOT_NAMES)], BOT_COLORS[j % len(BOT_COLORS)], True, rng)
        s = {"players": players, "snakes": snakes, "food": {}, "fid": 0, "radius": ARENA, "t": 0.0, "dead_order": [],
             "shrink": int(options.get("minutes", 3)) * 60, "bot_level": int(options.get("bot_level", 2)), "turn_no": 0,
             "new_food": [], "eaten": [], "kills": {}}
        g = cls(s, rng)
        for _ in range(FOOD_TARGET):
            g._add_food()
        s["new_food"], s["eaten"] = [], []
        return s

    @staticmethod
    def _spawn(i, total, name, color, bot, rng):
        ang = 2 * math.pi * i / max(1, total)
        r = ARENA * 0.6
        x, y = math.cos(ang) * r, math.sin(ang) * r
        heading = ang + math.pi  # face the centre
        body = [[x - math.cos(heading) * SPEED * k, y - math.sin(heading) * SPEED * k] for k in range(START_LEN)]
        return {"name": name, "color": color, "bot": bot, "x": x, "y": y, "a": heading, "target": heading,
                "boost": False, "len": START_LEN, "body": body, "alive": True, "grow": 0.0}

    # ---- food -----------------------------------------------------------------------------
    def _add_food(self, x=None, y=None, v=1):
        s = self.s
        if x is None:
            r = s["radius"] * math.sqrt(self.rng.random()) * 0.95
            t = self.rng.random() * 2 * math.pi
            x, y = r * math.cos(t), r * math.sin(t)
        s["fid"] += 1
        fid = str(s["fid"])
        s["food"][fid] = [round(x), round(y), v]
        s["new_food"].append([fid, round(x), round(y), v])

    # ---- simulation ---------------------------------------------------------------------------
    def input(self, pid, data, now):
        sn = self.s["snakes"].get(pid)
        if not sn or not sn["alive"] or sn["bot"]:
            return
        try:
            a = float(data.get("a", sn["target"]))
        except (TypeError, ValueError):
            return
        if math.isfinite(a):
            sn["target"] = a
        sn["boost"] = bool(data.get("b"))

    def _grid(self):
        grid: dict[tuple[int, int], list] = {}
        for sid, sn in self.s["snakes"].items():
            if not sn["alive"]:
                continue
            for k, (x, y) in enumerate(sn["body"]):
                grid.setdefault((int(x // CELL), int(y // CELL)), []).append((sid, k, x, y))
        return grid

    def _bot_steer(self, sid, sn, grid):
        s = self.s
        level = s["bot_level"]
        best, best_d = None, 1e18
        for f in s["food"].values():
            d = (f[0] - sn["x"]) ** 2 + (f[1] - sn["y"]) ** 2
            if d < best_d:
                best, best_d = f, d
        target = math.atan2(best[1] - sn["y"], best[0] - sn["x"]) if best else sn["a"]
        # Look ahead for danger and turn away from it.
        look = 60 + 30 * level
        for turn in (0, 0.6, -0.6, 1.2, -1.2, 2.0, -2.0):
            a = sn["a"] + turn if turn else target
            ok = True
            for step in (0.4, 0.7, 1.0):
                px, py = sn["x"] + math.cos(a) * look * step, sn["y"] + math.sin(a) * look * step
                if math.hypot(px, py) > s["radius"] - 20:
                    ok = False
                    break
                for other in grid.get((int(px // CELL), int(py // CELL)), []):
                    if other[0] != sid:
                        ok = False
                        break
                if not ok:
                    break
            if ok:
                sn["target"] = a
                break
        sn["boost"] = level >= 3 and best_d < 150 ** 2 and sn["len"] > 40 and self.rng.random() < 0.3

    def step(self, now):
        s = self.s
        if self.over:
            return
        s["t"] = now
        s["new_food"], s["eaten"] = [], []
        frac = min(1.0, now / max(1, s["shrink"]))
        s["radius"] = ARENA - (ARENA - 200) * frac
        grid = self._grid()
        for sid, sn in s["snakes"].items():
            if not sn["alive"]:
                continue
            if sn["bot"]:
                self._bot_steer(sid, sn, grid)
            diff = (sn["target"] - sn["a"] + math.pi) % (2 * math.pi) - math.pi
            sn["a"] += max(-TURN, min(TURN, diff))
            speed = BOOST if (sn["boost"] and sn["len"] > MIN_LEN) else SPEED
            if speed == BOOST:
                sn["grow"] -= 0.25
            sn["x"] += math.cos(sn["a"]) * speed
            sn["y"] += math.sin(sn["a"]) * speed
            sn["body"].insert(0, [sn["x"], sn["y"]])
            while sn["grow"] >= 1:
                sn["len"] += 1
                sn["grow"] -= 1
            while sn["grow"] <= -1 and sn["len"] > MIN_LEN:
                sn["len"] -= 1
                sn["grow"] += 1
                tail = sn["body"][-1]
                self._add_food(tail[0], tail[1], 1)
            del sn["body"][sn["len"]:]
        # Eating.
        for sid, sn in s["snakes"].items():
            if not sn["alive"]:
                continue
            reach = 18 + sn["len"] / 40
            for fid, f in list(s["food"].items()):
                if abs(f[0] - sn["x"]) < reach and abs(f[1] - sn["y"]) < reach:
                    sn["grow"] += f[2]
                    del s["food"][fid]
                    s["eaten"].append(fid)
        # Collisions.
        grid = self._grid()
        died = []
        for sid, sn in s["snakes"].items():
            if not sn["alive"]:
                continue
            if math.hypot(sn["x"], sn["y"]) > s["radius"]:
                died.append((sid, None))
                continue
            rad = 9 + min(12, sn["len"] / 50)
            cx, cy = int(sn["x"] // CELL), int(sn["y"] // CELL)
            hit = None
            for gx in (cx - 1, cx, cx + 1):
                for gy in (cy - 1, cy, cy + 1):
                    for other, k, x, y in grid.get((gx, gy), []):
                        if other == sid:
                            continue
                        o = s["snakes"][other]
                        orad = 9 + min(12, o["len"] / 50)
                        if (x - sn["x"]) ** 2 + (y - sn["y"]) ** 2 < (rad + orad) ** 2 * 0.55:
                            if k == 0 and o["len"] > sn["len"]:
                                hit = other
                            elif k == 0:
                                continue  # head-on: the longer snake survives
                            else:
                                hit = other
                            break
                    if hit:
                        break
                if hit:
                    break
            if hit:
                died.append((sid, hit))
        for sid, killer in died:
            sn = s["snakes"][sid]
            if not sn["alive"]:
                continue
            sn["alive"] = False
            for k, (x, y) in enumerate(sn["body"]):
                if k % 3 == 0:
                    self._add_food(x + self.rng.uniform(-6, 6), y + self.rng.uniform(-6, 6), 2)
            sn["body"] = []
            if not sn["bot"]:
                s["dead_order"].append(sid)
                self.bump("length", sid, 0)
            if killer and not s["snakes"][killer]["bot"]:
                self.bump("kills", killer)
        for sid, sn in s["snakes"].items():
            if not sn["bot"]:
                st = s.setdefault("stats", {}).setdefault("max_length", {})
                st[sid] = max(st.get(sid, 0), sn["len"] if sn["alive"] else 0)
        if len(s["food"]) < FOOD_TARGET * s["radius"] / ARENA:
            for _ in range(3):
                self._add_food()
        # Last human alive?
        humans = [p for p in self.ids()]
        alive = [p for p in humans if s["snakes"][p]["alive"]]
        if len(alive) <= 1:
            ranking = [[p] for p in alive] + [[p] for p in reversed(s["dead_order"])]
            self.finish(ranking, {p: s["snakes"][p]["len"] for p in humans})

    # ---- network ---------------------------------------------------------------------------------
    def frame(self):
        s = self.s
        return {"sn": [[sid, round(sn["x"]), round(sn["y"]), round(sn["a"], 2), sn["len"], 1 if sn["alive"] else 0,
                        1 if (sn["boost"] and sn["len"] > MIN_LEN) else 0] for sid, sn in s["snakes"].items()],
                "fa": s["new_food"], "fd": s["eaten"], "r": round(s["radius"]), "over": self.over}

    def snapshot(self):
        s = self.s
        return {"snakes": {sid: {"name": sn["name"], "color": sn["color"], "bot": sn["bot"], "alive": sn["alive"],
                                 "len": sn["len"], "body": [[round(x), round(y)] for x, y in sn["body"]]}
                           for sid, sn in s["snakes"].items()},
                "food": [[fid, f[0], f[1], f[2]] for fid, f in s["food"].items()], "r": round(s["radius"])}

    def view(self, pid):
        s = self.s
        return {**self.base_view(), "alive": {p: s["snakes"][p]["alive"] for p in self.ids()},
                "len": {p: s["snakes"][p]["len"] for p in self.ids()}, "t": s["t"], "shrink": s["shrink"]}

    def forfeit(self, pid, now):
        sn = self.s["snakes"].get(pid)
        if sn and sn["alive"]:
            sn["alive"] = False
            sn["body"] = []
            self.s["dead_order"].append(pid)
        return [{"e": "forfeit", "who": pid}]
