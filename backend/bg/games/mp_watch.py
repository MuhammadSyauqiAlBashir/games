"""Watch-carefully minigames: Thwomp the Difference, Big-Top Quiz, Wario's Buzzer Beater."""

from __future__ import annotations

import math

from .base import IllegalMove
from .mario import Mini, rounds_opt

# ---------------------------------------------------------------------------------------------------
# Thwomp the Difference: Thwomps rise (fully or halfway) to show fruit; tap the odd one out.
SIMILAR = [("🍎", "🍅"), ("🍎", "🍏"), ("🍊", "🍑"), ("🍋", "🍌"), ("🍇", "🫐"), ("🍓", "🍒"), ("🍐", "🍏"),
           ("🍉", "🥝"), ("🍈", "🍏"), ("🍑", "🍊"), ("🥥", "🌰"), ("🍍", "🥭")]
FRUITS = ["🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🍍", "🥝", "🍐", "🍏", "🥭"]
ASYM = {"🍌", "🍐", "🍒", "🍓", "🍍", "🍏", "🍎", "🥝", "🥭", "🍋", "🍑"}  # mirroring is visible


class ThwompDiff(Mini):
    key, name_id, name_en, icon = "mp_thwomp", "Thwomp the Difference", "Thwomp the Difference", "🗿"
    options = [rounds_opt(5, (3, 5, 7))]
    party_options = {"rounds": 4}

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 5)), items=[], peeks=[], odd=-1,
                        picks={}, order=[], got={})

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        k = s["round"]
        n = 3 if k <= 2 else 4
        if k <= 2:
            a, b = r.choice(SIMILAR)
            if r.random() < 0.5:
                a, b = b, a
            base, odd_item = {"f": a, "m": ""}, {"f": b, "m": ""}
        else:
            f = r.choice(FRUITS)
            mods = ["flip", "tilt", "hue", "small"] + (["mirror"] * 2 if f in ASYM else [])
            base, odd_item = {"f": f, "m": ""}, {"f": f, "m": r.choice(mods)}
        odd = r.randrange(n)
        s["items"] = [dict(odd_item if i == odd else base) for i in range(n)]
        s["odd"] = odd
        show = 6.0 + min(k, 5) * 0.4
        peeks = []
        dur = max(0.38, 0.85 - k * 0.07)
        for i in range(n):
            times = sorted(r.uniform(0.3, show - dur - 0.2) for _ in range(r.choice((2, 2, 3))))
            for j, t in enumerate(times):
                peeks.append([i, round(t, 2), round(dur * r.uniform(0.85, 1.2), 2), 1 if j == 0 or r.random() < 0.45 else 0])
        s["peeks"] = sorted(peeks, key=lambda p: p[1])
        s["show"] = show
        s["picks"], s["order"], s["got"] = {}, [], {}
        self.go("watch", now, show + 4.0)
        return [{"e": "round", "n": k}]

    def view(self, pid):
        s = self.s
        reveal = s["phase"] in ("reveal", "finish")
        return self.mview(items=s["items"], peeks=s["peeks"], show=s.get("show", 0), n=len(s["items"]),
                          mine=s["picks"].get(pid), picked=list(s["picks"]),
                          odd=s["odd"] if reveal else None, picks=s["picks"] if reveal else None, got=s["got"] if reveal else None)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "watch":
            raise IllegalMove("Wait for the Thwomps.")
        if pid in s["picks"]:
            raise IllegalMove("Already chosen.")
        i = int(a.get("i", -1))
        if not 0 <= i < len(s["items"]):
            raise IllegalMove("Pick a Thwomp.")
        s["picks"][pid] = i
        if i == s["odd"]:
            s["order"].append(pid)
        if len(s["picks"]) == len(self.ids()):
            s["deadline"] = min(s["deadline"], now + 0.3)
        return [{"e": "picked", "who": pid}]

    def on_watch(self, now):
        s = self.s
        s["got"] = self.award_order(s["order"])
        for pid in s["order"][:1]:
            self.bump("first", pid)
        self.go("reveal", now, 3.4)
        return [{"e": "reveal", "odd": s["odd"], "got": s["got"]}]

    def on_reveal(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


# ---------------------------------------------------------------------------------------------------
# Big-Top Quiz: every Toad carries ONE picture for the whole round. You see them, the balls turn so the pictures
# are hidden, the Toads shuffle around (some wave, some jump, a ball flashes now and then) — then a question.
IMGS = ["🍄", "⭐", "🐢", "👻", "💣", "🌸", "🦖", "🔥", "🍌", "👑"]
PEEK = 2.4  # seconds the pictures are shown before they turn away


class BigTopQuiz(Mini):
    key, name_id, name_en, icon = "mp_bigtop", "Big-Top Quiz", "Big-Top Quiz", "🎪"
    options = [rounds_opt(3, (3, 5))]
    party_options = {"rounds": 3}

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 3)), script={}, q={}, answer=-1,
                        picks={}, order=[], got={}, asked=[])

    def _motion(self, style, n, show):
        """Keyframes per toad [[t, x, y], ...] and, for swaps, how often each toad changed place."""
        r = self.rng
        home = [[14 + i * (72 / (n - 1)), 62] for i in range(n)]
        keys = [[[0.0, *home[i]]] for i in range(n)]
        moves = [0] * n
        start = PEEK + 0.6
        if style == "swap":
            slots = list(range(n))
            t = start
            while t < show - 1.0:
                a, b = r.sample(range(n), 2)
                ia, ib = slots.index(a), slots.index(b)
                d = r.uniform(0.45, 0.75)
                keys[ia] += [[round(t, 2), *home[a]], [round(t + d, 2), *home[b]]]
                keys[ib] += [[round(t, 2), *home[b]], [round(t + d, 2), *home[a]]]
                slots[ia], slots[ib] = b, a
                moves[ia] += 1
                moves[ib] += 1
                t += d + r.uniform(0.1, 0.4)
        elif style == "circle":
            turns = r.choice((1.25, 1.5, 1.75, 2.25)) * r.choice((1, -1))
            for k in range(1, int(show / 0.2) + 1):
                t = k * 0.2
                if t < start or t > show - 0.6:
                    continue
                p = (t - start) / (show - 0.6 - start)
                ease = p * p * (3 - 2 * p)
                for i in range(n):
                    ang = math.pi / 2 + 2 * math.pi * (i / n + turns * ease)
                    keys[i].append([round(t, 2), round(50 + math.cos(ang) * 32, 1), round(58 + math.sin(ang) * 15, 1)])
            # end in a neat row so left/right questions are fair
            final = sorted(range(n), key=lambda i: keys[i][-1][1])
            for rank, i in enumerate(final):
                keys[i].append([round(show - 0.15, 2), *home[rank]])
        else:  # wander, then line up
            t = start
            while t < show - 1.3:
                for i in range(n):
                    keys[i].append([round(t, 2), round(r.uniform(10, 90), 1), round(r.uniform(44, 76), 1)])
                t += r.uniform(0.6, 0.9)
            order = list(range(n))
            r.shuffle(order)
            for rank, i in enumerate(order):
                keys[i].append([round(show - 0.2, 2), *home[rank]])
        return keys, moves

    def begin(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        k = s["round"]
        n = 3 if k == 1 else 4 if k < 4 else 5
        style = ["swap", "circle", "wander"][(k - 1) % 3]
        show = PEEK + 5.5 + min(k, 4) * 0.6
        imgs = r.sample(IMGS, n)  # toad i carries imgs[i] for the whole round
        keys, moves = self._motion(style, n, show)
        start = PEEK + 0.6
        events = []  # [t, toad, kind]  kind: wave | jump | flash
        for _ in range(r.randint(1, 2) + (k > 1)):
            events.append([round(r.uniform(start + 0.3, show - 1.0), 2), r.randrange(n), "wave"])
        jumps = [0] * n
        for _ in range(r.randint(2, 4) + k):
            i = r.randrange(n)
            jumps[i] += 1
            events.append([round(r.uniform(start + 0.2, show - 0.8), 2), i, "jump"])
        for _ in range(r.randint(0, 2)):
            events.append([round(r.uniform(start + 1.0, show - 1.0), 2), r.randrange(n), "flash"])
        events.sort()
        final_x = {i: keys[i][-1][1] for i in range(n)}
        left_to_right = sorted(range(n), key=lambda i: final_x[i])
        kinds = ["where", "edge", "neighbor", "wave", "jumps"] + (["swaps"] if style == "swap" else [])
        if k == 1:
            kinds = ["where", "edge"]
        qtype = r.choice([x for x in kinds if x not in s["asked"]] or kinds)
        s["asked"].append(qtype)
        q: dict = {"type": qtype}
        ans = 0
        if qtype == "where":
            i = r.randrange(n)
            q.update(id=f"Di mana Toad pembawa {imgs[i]} sekarang? Ketuk Toad-nya!", en=f"Where is the Toad carrying {imgs[i]} now? Tap it!")
            ans = i
        elif qtype == "edge":
            which = r.choice(["left", "right"] + (["middle"] if n % 2 else []))
            i = left_to_right[0] if which == "left" else left_to_right[-1] if which == "right" else left_to_right[n // 2]
            q.update(id={"left": "Gambar apa yang sekarang paling KIRI?", "right": "Gambar apa yang sekarang paling KANAN?", "middle": "Gambar apa yang sekarang di TENGAH?"}[which],
                     en={"left": "Which picture is now on the far LEFT?", "right": "Which picture is now on the far RIGHT?", "middle": "Which picture is now in the MIDDLE?"}[which])
            ans = i
        elif qtype == "neighbor":
            pos = r.randrange(n - 1)
            a_, b_ = left_to_right[pos], left_to_right[pos + 1]
            if r.random() < 0.5:
                q.update(id=f"Gambar apa yang tepat di sebelah KANAN {imgs[a_]}?", en=f"Which picture is right of {imgs[a_]}?")
                ans = b_
            else:
                q.update(id=f"Gambar apa yang tepat di sebelah KIRI {imgs[b_]}?", en=f"Which picture is left of {imgs[b_]}?")
                ans = a_
        elif qtype == "wave":
            w = [e for e in events if e[2] == "wave"]
            last = w[-1]
            q.update(id="Toad yang TERAKHIR melambai membawa gambar apa?" if len(w) > 1 else "Toad yang melambai membawa gambar apa?",
                     en="What did the LAST Toad to wave carry?" if len(w) > 1 else "What did the waving Toad carry?")
            ans = last[1]
        elif qtype == "jumps":
            top = max(jumps)
            if jumps.count(top) > 1:
                i = jumps.index(top)
                jumps[i] += 1
                events.append([round(show - 0.9, 2), i, "jump"])
                events.sort()
            ans = jumps.index(max(jumps))
            q.update(id="Toad pembawa gambar apa yang PALING SERING melompat?", en="Which picture's Toad jumped the MOST?")
        if qtype == "swaps":
            i = r.randrange(n)
            c = moves[i]
            opts_ = sorted({c, *[max(0, c + d) for d in r.sample([-2, -1, 1, 2], 3)]})[:4]
            while len(opts_) < 4:
                opts_.append(opts_[-1] + 1)
            q.update(id=f"Berapa kali Toad pembawa {imgs[i]} pindah tempat?", en=f"How many times did the {imgs[i]} Toad change places?",
                     choices=[str(x) for x in opts_])
            ans = opts_.index(c)
        elif qtype != "where":
            choices = list(range(n))
            r.shuffle(choices)
            q["choices"] = [imgs[i] for i in choices]
            ans = choices.index(ans)
        s["q"], s["answer"] = q, ans
        s["script"] = {"n": n, "style": style, "keys": keys, "imgs": imgs, "events": events, "show": show, "peek": PEEK}
        s["picks"], s["order"], s["got"] = {}, [], {}
        self.go("show", now, show)
        return [{"e": "round", "n": k}]

    def view(self, pid):
        s = self.s
        reveal = s["phase"] in ("reveal", "finish")
        return self.mview(script=s["script"], q=s["q"] if s["phase"] in ("ask", "reveal", "finish") else None,
                          mine=s["picks"].get(pid), picked=list(s["picks"]),
                          answer=s["answer"] if reveal else None, picks=s["picks"] if reveal else None,
                          got=s["got"] if reveal else None)

    def on_show(self, now):
        self.go("ask", now, 10.0)
        return [{"e": "ask"}]

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "ask":
            raise IllegalMove("Watch first!")
        if pid in s["picks"]:
            raise IllegalMove("Already answered.")
        i = int(a.get("i", -1))
        limit = s["script"]["n"] if s["q"]["type"] == "where" else len(s["q"]["choices"])
        if not 0 <= i < limit:
            raise IllegalMove("Choose an answer.")
        s["picks"][pid] = i
        if i == s["answer"]:
            s["order"].append(pid)
        if len(s["picks"]) == len(self.ids()):
            s["deadline"] = min(s["deadline"], now + 0.3)
        return [{"e": "picked", "who": pid}]

    def on_ask(self, now):
        s = self.s
        s["got"] = self.award_order(s["order"])
        self.go("reveal", now, 4.0)
        return [{"e": "reveal", "got": s["got"]}]

    def on_reveal(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.begin(now)


# ---------------------------------------------------------------------------------------------------
# Wario's Buzzer Beater: 10 bite-sized picture puzzles. First correct answer takes the point;
# a wrong answer locks you out of that question.
TRACK_ICONS = ["🪙", "⭐", "💣", "🍄", "❓", "🔥"]
SPECIES = ["🐢", "👻", "🍄", "🐧", "🐸", "🐝"]
POSES = ["🏃", "🦖", "🐌", "🚴", "🏌️", "🦕", "🐿️", "🦘"]


def _maze(r, w=7):
    """Perfect maze on w×w cells; returns (right walls, down walls, parent map)."""
    right = [[True] * w for _ in range(w)]
    down = [[True] * w for _ in range(w)]
    seen = {(w // 2, w // 2)}
    stack = [(w // 2, w // 2)]
    parent = {(w // 2, w // 2): None}
    while stack:
        x, y = stack[-1]
        nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < w
              and (x + dx, y + dy) not in seen]
        if not nb:
            stack.pop()
            continue
        nx, ny = r.choice(nb)
        if nx != x:
            right[y][min(x, nx)] = False
        else:
            down[min(y, ny)][x] = False
        seen.add((nx, ny))
        parent[(nx, ny)] = (x, y)
        stack.append((nx, ny))
    return right, down, parent


def _path(parent, cell):
    out = []
    while parent[cell] is not None:
        out.append((parent[cell], cell))
        cell = parent[cell]
    return out


class BuzzerBeater(Mini):
    key, name_id, name_en, icon = "mp_buzzer", "Wario's Buzzer Beater", "Wario's Buzzer Beater", "🔔"
    options = [rounds_opt(10, (6, 10, 14))]
    party_options = {"rounds": 6}
    LIMIT = 10.0

    @classmethod
    def setup(cls, players, options, rng, now):
        return cls.init(players, now, round=0, rounds=int(options.get("rounds", 10)), q={}, answer=-1, locked=[],
                        winner=None, picks={}, types=[])

    # ---- generators: each returns (spec, choices, answer index) --------------------------------------
    def g_coins(self):
        r = self.rng
        n = r.randint(8, 21)
        pts = []
        while len(pts) < n:
            p = [round(r.uniform(8, 92), 1), round(r.uniform(10, 90), 1)]
            if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > 110 for q in pts):
                pts.append(p)
        opts = {n}
        while len(opts) < 4:
            opts.add(max(3, n + r.choice((-3, -2, -1, 1, 2, 3))))
        ch_ = sorted(opts)
        return {"pts": pts, "hide": 2.6, "q": {"id": "Ada berapa koin?", "en": "How many coins?"}}, [str(c) for c in ch_], ch_.index(n)

    def g_maze(self):
        r = self.rng
        w = 7
        exits = {"N": (3, 0), "E": (6, 3), "S": (3, 6), "W": (0, 3)}
        while True:  # the good exit's path must not run through another exit
            right, down, parent = _maze(r, w)
            good = r.choice(list(exits))
            good_path = set(_path(parent, exits[good]))
            cands = {k: [e for e in _path(parent, c) if e not in good_path] for k, c in exits.items() if k != good}
            if all(cands.values()):
                break
        for k, cand in cands.items():
            (ax, ay), (bx, by) = r.choice(cand)
            if ax != bx:
                right[ay][min(ax, bx)] = True
            else:
                down[min(ay, by)][ax] = True
        order = ["N", "E", "S", "W"]
        return ({"w": w, "right": right, "down": down, "q": {"id": "Pintu keluar mana yang bisa dicapai Wario?", "en": "Which exit can Wario reach?"}},
                order, order.index(good))

    def g_dice(self):
        r = self.rng
        track = [r.choice(TRACK_ICONS[:5]) for _ in range(12)]
        roll = r.randint(1, 6)
        arrows = r.random() < 0.6
        land = roll
        if arrows:
            k = r.randint(2, 6)
            track[k] = r.choice(("⏩", "⏪"))
        track[0] = "🏁"
        pos = land
        if track[pos] == "⏩":
            pos = min(11, pos + 2)
        elif track[pos] == "⏪":
            pos = max(1, pos - 2)
        while track[pos] in ("⏩", "⏪", "🏁"):
            track[pos] = r.choice(TRACK_ICONS[:5])
        ans = track[pos]
        others = [t for t in TRACK_ICONS if t != ans]
        choices = [ans] + r.sample(others, 3)
        r.shuffle(choices)
        return ({"track": track, "roll": roll, "q": {"id": "Wario mendarat di gambar apa? (⏩ maju 2, ⏪ mundur 2)", "en": "Where does Wario land? (⏩ +2, ⏪ −2)"}},
                choices, choices.index(ans))

    def g_fuzzy(self):
        r = self.rng
        counts = r.sample(range(3, 9), 4)
        tracks = []
        for c in counts:
            speed = r.choice((-1, 1)) * r.uniform(12, 30)
            xs = sorted(r.uniform(0, 100) for _ in range(c))
            tracks.append({"n": c, "v": round(speed, 1), "x": [round(x, 1) for x in xs]})
        best = counts.index(max(counts))
        return {"tracks": tracks, "q": {"id": "Lintasan mana yang Fuzzy-nya paling banyak?", "en": "Which track has the most Fuzzies?"}}, ["A", "B", "C", "D"], best

    def g_creeper(self):
        r = self.rng
        longest = r.random() < 0.5
        while True:
            paths, lens = [], []
            for _ in range(4):
                pts, y, x = [[50, 96]], 96, 50.0
                segs = r.randint(4, 9)
                for _ in range(segs):
                    y -= r.uniform(5, 12)
                    x = min(88, max(12, x + r.uniform(-26, 26)))
                    pts.append([round(x, 1), round(max(8, y), 1)])
                paths.append(pts)
                lens.append(sum(math.dist(a, b) for a, b in zip(pts, pts[1:])))
            s = sorted(lens, reverse=longest)
            if abs(s[0] - s[1]) / s[0] > 0.1:
                break
        ans = lens.index(max(lens) if longest else min(lens))
        q = {"id": "Tanaman merambat mana yang paling PANJANG?", "en": "Which creeper is the LONGEST?"} if longest else \
            {"id": "Tanaman merambat mana yang paling PENDEK?", "en": "Which creeper is the SHORTEST?"}
        return {"paths": paths, "q": q}, ["A", "B", "C", "D"], ans

    def g_cogs(self):
        r = self.rng
        pose = r.choice(POSES)
        odd = r.randrange(4)
        mod = r.choice(("mirror", "flip"))
        return ({"pose": pose, "odd_mod": mod, "odd": odd, "spin": [round(r.uniform(260, 460) * r.choice((1, -1))) for _ in range(4)],
                 "q": {"id": "Roda mana yang berbeda?", "en": "Which cog is different?"}}, ["A", "B", "C", "D"], odd)

    def g_crowd(self):
        r = self.rng
        k = r.choice((2, 3))
        sp = r.sample(SPECIES, k)
        while True:
            counts = [r.randint(4, 11) for _ in sp]
            if sorted(counts)[-1] != sorted(counts)[-2]:
                break
        bugs = []
        for i, c in enumerate(counts):
            for _ in range(c):
                bugs.append([i, round(r.uniform(6, 94), 1), round(r.uniform(8, 92), 1), round(r.uniform(-18, 18), 1), round(r.uniform(-14, 14), 1)])
        r.shuffle(bugs)
        return {"species": sp, "bugs": bugs, "q": {"id": "Pintu mana yang lebih ramai? (siapa paling banyak)", "en": "Which door has more?"}}, sp, counts.index(max(counts))

    def g_bullets(self):
        r = self.rng
        n = 5
        sr, sc = r.randrange(n), r.randrange(n)
        rows = [i for i in range(n) if i != sr]
        cols = [i for i in range(n) if i != sc]
        cells = {(sr, sc)}
        while len(cells) < 4:
            cells.add((r.randrange(n), r.randrange(n)))
        cells = list(cells)
        r.shuffle(cells)
        return ({"n": n, "rows": rows, "cols": cols, "cells": [list(c) for c in cells],
                 "q": {"id": "Kotak mana yang aman dari Bullet Bill?", "en": "Which square is safe from the Bullet Bills?"}},
                ["A", "B", "C", "D"], cells.index((sr, sc)))

    GENS = ["coins", "maze", "dice", "fuzzy", "creeper", "cogs", "crowd", "bullets"]

    def begin(self, now):
        return self.next_q(now)

    def next_q(self, now):
        s, r = self.s, self.rng
        s["round"] += 1
        pool = [g for g in self.GENS if s["types"].count(g) < 2 and (not s["types"] or s["types"][-1] != g)]
        kind = r.choice(pool)
        s["types"].append(kind)
        spec, choices, ans = getattr(self, "g_" + kind)()
        s["q"] = {"type": kind, "spec": spec, "choices": choices}
        s["answer"], s["locked"], s["winner"], s["picks"] = ans, [], None, {}
        self.go("q", now, self.LIMIT)
        return [{"e": "question", "n": s["round"]}]

    def view(self, pid):
        s = self.s
        reveal = s["phase"] in ("reveal", "finish")
        return self.mview(q=s["q"], locked=s["locked"], mine=s["picks"].get(pid),
                          answer=s["answer"] if reveal else None, winner=s["winner"], picks=s["picks"] if reveal else None)

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "q":
            raise IllegalMove("Wait for the next question.")
        if pid in s["locked"] or pid in s["picks"]:
            raise IllegalMove("You're locked out of this one.")
        i = int(a.get("i", -1))
        if not 0 <= i < len(s["q"]["choices"]):
            raise IllegalMove("Choose an answer.")
        s["picks"][pid] = i
        if i == s["answer"]:
            s["winner"] = pid
            s["scores"][pid] += 1
            self.bump("buzz", pid)
            return self._reveal(now, [{"e": "buzz", "who": pid, "ok": True}])
        s["locked"].append(pid)
        ev = [{"e": "buzz", "who": pid, "ok": False}]
        if len(s["locked"]) == len(self.ids()):
            return self._reveal(now, ev)
        return ev

    def _reveal(self, now, ev):
        self.go("reveal", now, 2.8)
        return ev + [{"e": "reveal", "winner": self.s["winner"]}]

    def on_q(self, now):
        return self._reveal(now, [])

    def on_reveal(self, now):
        if self.s["round"] >= self.s["rounds"]:
            return self.end(now)
        return self.next_q(now)
