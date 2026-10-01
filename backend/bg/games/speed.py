"""Speed challenges.

Bom Kata (word bomb): the bomb sits with one player and shows 2–3 letters; type a real word containing them
before it explodes (the fuse is secret and gets shorter). A word passes the bomb on. Explosion = lose a life.
Last one standing wins.

Refleks Kilat: tap the moment it happens — green light, the target emoji among decoys, or the colour word
whose meaning matches its ink. The phone measures the reaction time; tapping too early is a false start.

Ketik Ngebut: everyone types the same sentence; live progress cars; first correct finisher wins the round.

Cari Kembar (Spot it): your card and the middle card share exactly one picture. Tap it first to take the middle
card (it becomes your card) — a wrong tap freezes you for a moment."""

from __future__ import annotations

import json
import math
import os
from functools import lru_cache

from .. import lexicon, util
from .base import Game, IllegalMove, ch, opt, rank_by_score

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
LANG_OPT = opt("lang", "Bahasa", "Language", "select", "id", [ch("id", "Indonesia"), ch("en", "English")])
PLACE_PTS = [5, 3, 2, 1]


def place_points(order: list[str]) -> dict[str, int]:
    return {p: (PLACE_PTS[i] if i < len(PLACE_PTS) else 1) for i, p in enumerate(order)}


# =====================================================================================================
# Bom Kata
# =====================================================================================================

class BomKata(Game):
    key, name_id, name_en, icon = "bomkata", "Bom Kata", "Word Bomb", "💣"
    kind = "timed"
    min_players, max_players = 2, 8
    default_timer = 0
    options = [
        LANG_OPT,
        opt("lives", "Nyawa", "Lives", "select", 3, [ch(n, f"{n} ❤️") for n in (2, 3, 4)]),
        opt("level", "Tingkat huruf", "Letter difficulty", "select", 1, [ch(1, "Mudah", "Easy"), ch(2, "Sedang", "Medium"), ch(3, "Sulit", "Hard")]),
        opt("fuse", "Sumbu", "Fuse", "select", "normal", [ch("santai", "Santai (lama)", "Relaxed (long)"), ch("normal", "Normal"), ch("cepat", "Cepat!", "Fast!")]),
    ]
    FUSE = {"santai": (10.0, 22.0, 6.0), "normal": (7.0, 15.0, 4.5), "cepat": (4.5, 10.0, 3.0)}

    @classmethod
    def setup(cls, players, options, rng, now):
        lives = int(options.get("lives", 3))
        ids = [p["id"] for p in players]
        rng.shuffle(ids)
        return {"players": players, "order": ids, "lives": {p: lives for p in ids}, "max_lives": lives + 1,
                "lang": options.get("lang", "id"), "level": int(options.get("level", 1)), "fuse": options.get("fuse", "normal"),
                "phase": "intro", "deadline": 3.0, "turn": None, "turn_no": 0, "syl": "", "used": [], "typing": "",
                "since": 0.0, "boom_at": 0.0, "n": 0, "out": [], "scores": {p: 0 for p in ids}, "last": None,
                "letters": {p: [] for p in ids}}

    def turn(self):
        return [self.s["turn"]] if self.s["turn"] and self.s["phase"] == "play" and not self.over else []

    def alive(self) -> list[str]:
        return [p for p in self.s["order"] if self.s["lives"][p] > 0]

    def view(self, pid):
        s = self.s
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "syl": s["syl"], "typing": s["typing"],
                "since": s["since"], "lives": s["lives"], "order": s["order"], "scores": s["scores"], "last": s["last"],
                "used": len(s["used"]), "lang": s["lang"], "n": s["n"], "max_lives": s["max_lives"],
                "bonus": "abcdefghijklmnoprstuwy" if s["lang"] == "id" else "abcdefghijklmnoprstuvwy",
                "letters": s["letters"].get(pid, []) if pid else []}

    def _fuse(self) -> float:
        lo, hi, floor = self.FUSE.get(self.s["fuse"], self.FUSE["normal"])
        k = 0.97 ** self.s["n"]
        return max(floor, self.rng.uniform(lo, hi) * k)

    def _give(self, pid, now, new_syl=True):
        s = self.s
        s["turn"] = pid
        s["turn_no"] += 1
        if new_syl:
            s["syl"] = lexicon.syllable(s["lang"], s["level"], self.rng, {s["syl"]})
        s["typing"] = ""
        s["since"] = now
        s["boom_at"] = now + self._fuse()

    def _next_alive(self, pid):
        order, alive = self.s["order"], set(self.alive())
        i = order.index(pid) if pid in order else -1
        for k in range(1, len(order) + 1):
            q = order[(i + k) % len(order)]
            if q in alive:
                return q
        return pid

    def tick(self, now):
        s = self.s
        if self.over:
            return []
        if s["phase"] == "intro" and now >= s["deadline"]:
            s["phase"] = "play"
            self._give(s["order"][0], now)
            return [{"e": "go"}]
        if s["phase"] == "play" and now >= s["boom_at"]:
            who = s["turn"]
            s["lives"][who] -= 1
            s["phase"], s["deadline"] = "boom", now + 2.4
            s["turn_no"] += 1
            ev = [{"e": "boom", "who": who, "syl": s["syl"]}]
            if s["lives"][who] <= 0:
                s["out"].append(who)
                ev.append({"e": "out", "who": who})
            return ev
        if s["phase"] == "boom" and now >= s["deadline"]:
            alive = self.alive()
            if len(alive) <= 1:
                ranking = [[p] for p in alive] + [[p] for p in reversed(s["out"])]
                self.finish(ranking)
                return [{"e": "end"}]
            s["phase"] = "play"
            self._give(self._next_alive(s["turn"]), now)
            return [{"e": "go"}]
        return []

    def act(self, pid, a, now):
        s = self.s
        do = a.get("do")
        if s["phase"] != "play" or pid != s["turn"]:
            if do == "type":
                return []
            raise IllegalMove("Bukan giliranmu.")
        if do == "type":
            s["typing"] = lexicon.clean(a.get("text", ""))[:30]
            return [{"e": "typing"}]
        if do != "word":
            raise IllegalMove("?")
        w = lexicon.clean(a.get("w", ""))[:30]
        s["typing"] = w
        why = None
        if s["syl"] not in w.replace("-", ""):
            why = "syl"
        elif len(w.replace("-", "")) <= len(s["syl"]) or len(w) < 3:
            why = "short"
        elif w in s["used"]:
            why = "used"
        elif not lexicon.is_word(s["lang"], w):
            why = "unknown"
        if why:
            return [{"e": "bad", "who": pid, "w": w, "why": why}]
        s["used"].append(w)
        s["n"] += 1
        s["scores"][pid] += 1
        self.bump("words", pid)
        ev = [{"e": "good", "who": pid, "w": w, "syl": s["syl"]}]
        # bonus letters: use every letter of the alphabet (minus rare ones) to win a life back
        mine = set(s["letters"][pid]) | set(w)
        bonus = set(self.view(pid)["bonus"])
        if bonus <= mine:
            mine = set()
            if s["lives"][pid] < s["max_lives"]:
                s["lives"][pid] += 1
                ev.append({"e": "life", "who": pid})
        s["letters"][pid] = sorted(mine & bonus)
        s["last"] = {"who": pid, "w": w, "syl": s["syl"]}
        self._give(self._next_alive(pid), now)
        return ev

    def forfeit(self, pid, now):
        s = self.s
        if s["lives"].get(pid, 0) > 0:
            s["lives"][pid] = 0
            s["out"].append(pid)
        if s["turn"] == pid and s["phase"] == "play":
            alive = self.alive()
            if len(alive) > 1:
                self._give(self._next_alive(pid), now)
        if len(self.alive()) <= 1:
            self.finish([[p] for p in self.alive()] + [[p] for p in reversed(s["out"])])
        return [{"e": "forfeit", "who": pid}]


# =====================================================================================================
# Refleks Kilat
# =====================================================================================================

TARGETS = [("🐸", ["🐢", "🦎", "🐊", "🥒", "🍏"]), ("🍌", ["🌽", "🧀", "🍋", "🌙", "🥖"]), ("🚀", ["✈️", "🛸", "🚁", "🎯", "🛰️"]),
           ("🐱", ["🐯", "🦁", "🐶", "🐹", "🐰"]), ("⚽", ["🏀", "🎾", "🏐", "⚾", "🥎"]), ("🍉", ["🍓", "🍅", "🍎", "🍒", "🌶️"]),
           ("👻", ["💀", "☁️", "🐑", "🍙", "🧻"]), ("🦆", ["🐥", "🐤", "🐔", "🦢", "🕊️"]), ("🍩", ["🥯", "🍪", "🧇", "🥐", "🍘"])]
COLORS = [("MERAH", "RED", "#e5484d"), ("BIRU", "BLUE", "#2b64e0"), ("HIJAU", "GREEN", "#2fa84f"), ("KUNING", "YELLOW", "#f0b400"),
          ("UNGU", "PURPLE", "#8e44d6")]


class Refleks(Game):
    key, name_id, name_en, icon = "refleks", "Refleks Kilat", "Lightning Reflex", "⚡"
    kind = "timed"
    min_players, max_players = 1, 8
    default_timer = 0
    options = [
        opt("rounds", "Ronde", "Rounds", "select", 8, [ch(n, str(n)) for n in (5, 8, 12)]),
        opt("mode", "Jenis", "Kind", "select", "mix", [ch("mix", "Campur", "Mix"), ch("green", "Lampu hijau", "Green light"),
                                                       ch("target", "Cari target", "Find the target"), ch("stroop", "Kata & warna", "Word & colour")]),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        n = int(options.get("rounds", 8))
        mode = options.get("mode", "mix")
        kinds = [mode] * n if mode != "mix" else [["green", "target", "stroop"][i % 3] for i in range(n)]
        if mode == "mix":
            rng.shuffle(kinds)
            kinds[0] = "green"
        rounds = [cls.make_round(k, rng) for k in kinds]
        return {"players": players, "rounds": rounds, "r": 0, "phase": "ready", "deadline": 3.5, "t0": 0.0,
                "res": {}, "scores": {p["id"]: 0 for p in players}, "best": {}, "turn_no": 0, "last": None}

    @staticmethod
    def make_round(kind: str, rng) -> dict:
        if kind == "green":
            return {"k": "green", "go": round(rng.uniform(1.6, 5.2), 2)}
        if kind == "target":
            target, look = rng.choice(TARGETS)
            seq, t = [], 0.9
            for _ in range(rng.randint(3, 7)):
                seq.append([round(t, 2), rng.choice(look)])
                t += rng.uniform(0.55, 0.9)
            seq.append([round(t, 2), target])
            return {"k": "target", "target": target, "seq": seq, "go": round(t, 2)}
        seq, t = [], 0.9
        for _ in range(rng.randint(3, 7)):
            w, ink = rng.sample(range(len(COLORS)), 2)
            seq.append([round(t, 2), w, ink])
            t += rng.uniform(0.6, 0.95)
        w = rng.randrange(len(COLORS))
        seq.append([round(t, 2), w, w])
        return {"k": "stroop", "seq": seq, "go": round(t, 2), "colors": COLORS}

    def turn(self):
        return []

    def view(self, pid):
        s = self.s
        rd = s["rounds"][s["r"]]
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "t0": s["t0"], "round": s["r"] + 1,
                "rounds": len(s["rounds"]), "rd": rd, "res": s["res"], "scores": s["scores"], "best": s["best"],
                "last": s["last"]}

    def _end_round(self, now):
        s = self.s
        ok = sorted((ms, p) for p, (kind, ms) in s["res"].items() if kind == "ok")
        pts = place_points([p for _, p in ok])
        for p, v in pts.items():
            s["scores"][p] += v
        for ms, p in ok:
            s["best"][p] = min(s["best"].get(p, 99999), ms)
        if ok:
            self.bump("fastest", ok[0][1])
        s["last"] = {"pts": pts, "res": s["res"]}
        s["phase"], s["deadline"] = "result", now + 3.2
        s["turn_no"] += 1
        return [{"e": "result", "pts": pts}]

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "ready":
            rd = s["rounds"][s["r"]]
            s["phase"], s["t0"], s["res"] = "run", now, {}
            s["deadline"] = now + rd["go"] + 2.5
            s["turn_no"] += 1
            return [{"e": "run"}]
        if s["phase"] == "run":
            return self._end_round(now)
        if s["phase"] == "result":
            if s["r"] + 1 >= len(s["rounds"]):
                ids = self.ids()
                ranking = sorted(ids, key=lambda p: (-s["scores"][p], s["best"].get(p, 99999)))
                groups, prev = [], None
                for p in ranking:
                    key = (s["scores"][p], s["best"].get(p, 99999))
                    if key == prev:
                        groups[-1].append(p)
                    else:
                        groups.append([p])
                    prev = key
                self.finish(groups)
                return [{"e": "end"}]
            s["r"] += 1
            s["phase"], s["deadline"] = "ready", now + 2.6
            s["turn_no"] += 1
            return [{"e": "ready"}]
        return []

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "run" or int(a.get("r", -1)) != s["r"] + 1 or pid in s["res"]:
            return []
        if a.get("do") == "false":
            s["res"][pid] = ["false", 0]
        elif a.get("do") == "tap":
            ms = int(a.get("ms", 0))
            if ms < 90:      # faster than humanly possible = a lucky early tap
                s["res"][pid] = ["false", 0]
            else:
                s["res"][pid] = ["ok", min(ms, 2500)]
        else:
            return []
        if all(p in s["res"] for p in self.ids()):
            return [{"e": "tap", "who": pid}] + self._end_round(now)
        return [{"e": "tap", "who": pid}]


# =====================================================================================================
# Ketik Ngebut
# =====================================================================================================

def type_norm(text: str) -> str:
    """What has to be typed: lowercase letters/digits and single spaces (no punctuation — phones are slow at it)."""
    return util.norm(text)


class Ketik(Game):
    key, name_id, name_en, icon = "ketik", "Ketik Ngebut", "Speed Typing", "⌨️"
    kind = "timed"
    min_players, max_players = 1, 8
    default_timer = 0
    options = [
        LANG_OPT,
        opt("rounds", "Ronde", "Rounds", "select", 3, [ch(n, str(n)) for n in (1, 3, 5)]),
        opt("kind", "Teks", "Text", "select", "mix", [ch("mix", "Campur", "Mix"), ch("kalimat", "Kalimat seru", "Fun facts"),
                                                      ch("pantun", "Pantun & peribahasa", "Rhymes & sayings"), ch("kata", "Kata acak", "Random words")]),
    ]

    @classmethod
    def texts(cls) -> dict:
        with open(os.path.join(DATA, "ketik.json")) as f:
            return json.load(f)

    @classmethod
    def setup(cls, players, options, rng, now):
        lang, kind = options.get("lang", "id"), options.get("kind", "mix")
        bank = cls.texts()[lang]
        rounds = []
        kinds = ["kalimat", "pantun", "kata"] if kind == "mix" else [kind]
        used = set()
        for i in range(int(options.get("rounds", 3))):
            k = kinds[i % len(kinds)]
            if k == "kata":
                words = rng.sample(bank["kata"], 10)
                text = " ".join(words)
            else:
                pool = [t for t in bank[k] if t not in used] or bank[k]
                text = rng.choice(pool)
                used.add(text)
            rounds.append({"k": k, "text": text, "target": type_norm(text)})
        return {"players": players, "rounds": rounds, "r": 0, "phase": "ready", "deadline": 4.0, "t0": 0.0,
                "prog": {}, "done": {}, "errs": {}, "scores": {p["id"]: 0 for p in players}, "wpm": {}, "turn_no": 0,
                "last": None}

    def turn(self):
        return []

    def view(self, pid):
        s = self.s
        rd = s["rounds"][s["r"]]
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "t0": s["t0"], "round": s["r"] + 1,
                "rounds": len(s["rounds"]), "text": rd["text"], "target": rd["target"], "prog": s["prog"], "done": s["done"],
                "scores": s["scores"], "wpm": s["wpm"], "last": s["last"]}

    def _limit(self) -> float:
        return min(150.0, 20 + len(self.s["rounds"][self.s["r"]]["target"]) * 0.55)

    def _end_round(self, now):
        s = self.s
        order = sorted(s["done"], key=lambda p: s["done"][p]["t"])
        pts = place_points(order)
        for p, v in pts.items():
            s["scores"][p] += v
        if order:
            self.bump("typing_wins", order[0])
        s["last"] = {"pts": pts, "done": s["done"]}
        s["phase"], s["deadline"] = "result", now + 5
        s["turn_no"] += 1
        return [{"e": "result", "pts": pts}]

    def tick(self, now):
        s = self.s
        if self.over or now < s["deadline"]:
            return []
        if s["phase"] == "ready":
            s["phase"], s["t0"], s["deadline"] = "play", now, now + self._limit()
            s["prog"], s["done"] = {p: 0 for p in self.ids()}, {}
            s["turn_no"] += 1
            return [{"e": "go"}]
        if s["phase"] == "play":
            return self._end_round(now)
        if s["phase"] == "result":
            if s["r"] + 1 >= len(s["rounds"]):
                ranking = sorted(self.ids(), key=lambda p: (-s["scores"][p], -s["wpm"].get(p, 0)))
                self.finish([[p] for p in ranking])
                return [{"e": "end"}]
            s["r"] += 1
            s["phase"], s["deadline"] = "ready", now + 3.5
            s["turn_no"] += 1
            return [{"e": "ready"}]
        return []

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or pid in s["done"]:
            return []
        target = s["rounds"][s["r"]]["target"]
        if a.get("do") == "p":
            n = max(0, min(int(a.get("n", 0)), len(target) - 1))
            if n == s["prog"].get(pid):
                return []
            s["prog"][pid] = n
            return [{"e": "p"}]
        if a.get("do") == "done":
            if type_norm(a.get("text", "")) != target:
                raise IllegalMove("Masih ada yang salah ketik.")
            t = max(0.5, now - s["t0"])
            wpm = round(len(target) / 5 / (t / 60))
            s["prog"][pid] = len(target)
            s["done"][pid] = {"t": round(t, 2), "wpm": wpm, "errs": max(0, min(999, int(a.get("errs", 0))))}
            s["wpm"][pid] = max(s["wpm"].get(pid, 0), wpm)
            ev = [{"e": "finish", "who": pid, "place": len(s["done"]), "wpm": wpm}]
            if len(s["done"]) == len(self.ids()):
                ev += self._end_round(now)
            elif len(s["done"]) == 1:
                s["deadline"] = min(s["deadline"], now + 25)  # the rest get 25 s more
            s["turn_no"] += 1
            return ev
        return []


# =====================================================================================================
# Cari Kembar (Spot it)
# =====================================================================================================

SYMBOLS = ["🍎", "🍌", "🍇", "🍉", "🍓", "🍕", "🍩", "🍦", "🧀", "🥕", "🌶️", "🍄", "🌵", "🌻", "🍀", "🌙", "⭐", "☀️", "⚡",
           "❄️", "🔥", "💧", "🌈", "⛄", "🐱", "🐶", "🐸", "🐵", "🐼", "🦁", "🐢", "🐙", "🦋", "🐝", "🐞", "🦀", "🐘", "🦒",
           "🐧", "🦉", "🚗", "🚀", "✈️", "🚲", "⚽", "🎈", "🎸", "🎁", "🔑", "⏰", "💡", "📷", "✏️", "🎩", "👓", "❤️", "💎"]


@lru_cache(maxsize=1)
def dobble_deck(n: int = 7) -> list[list[int]]:
    """n²+n+1 cards of n+1 symbols; every two cards share exactly one symbol (projective plane, n prime)."""
    cards = [[0] + [1 + i * n + j for j in range(n)] for i in range(n + 1)]
    for i in range(n):
        for j in range(n):
            cards.append([i + 1] + [n + 1 + n * k + ((i * k + j) % n) for k in range(n)])
    return cards


class Kembar(Game):
    key, name_id, name_en, icon = "kembar", "Cari Kembar", "Spot the Twin", "👀"
    kind = "timed"
    min_players, max_players = 1, 6
    default_timer = 0
    options = [opt("target", "Menang di", "First to", "select", 10, [ch(n, f"{n} kartu", f"{n} cards") for n in (5, 10, 15, 20)])]

    @classmethod
    def setup(cls, players, options, rng, now):
        deck = list(range(57))
        rng.shuffle(deck)
        s = {"players": players, "deck": deck, "cards": {}, "lay": {}, "center": None, "phase": "ready", "deadline": 3.5,
             "scores": {p["id"]: 0 for p in players}, "frozen": {}, "target": int(options.get("target", 10)), "turn_no": 0,
             "last": None, "c": 0}
        return s

    def _layout(self, card: int):
        # 8 pictures: one in the middle, seven around; random sizes and turns make it harder
        rng = self.rng
        syms = dobble_deck()[card][:]
        rng.shuffle(syms)
        base = rng.uniform(0, 360)
        out = []
        for i, sym in enumerate(syms):
            if i == 0:
                x, y, r = 50 + rng.uniform(-2, 2), 50 + rng.uniform(-2, 2), rng.uniform(11.5, 14)
            else:
                a = math.radians(base + (i - 1) * 360 / 7 + rng.uniform(-7, 7))
                d = rng.uniform(30, 32.5)
                x, y, r = 50 + d * math.cos(a), 50 + d * math.sin(a), rng.uniform(7.5, 10.5)
            out.append([sym, round(x, 1), round(y, 1), round(r, 1), rng.randrange(-45, 46) if rng.random() < 0.7 else rng.randrange(0, 360)])
        return out

    def _deal(self) -> int | None:
        s = self.s
        if not s["deck"]:
            return None
        c = s["deck"].pop()
        s["lay"][str(c)] = self._layout(c)
        return c

    def turn(self):
        return []

    def view(self, pid):
        s = self.s
        mine = s["cards"].get(pid) if pid else None
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "scores": s["scores"], "target": s["target"],
                "center": s["lay"].get(str(s["center"])) if s["center"] is not None else None, "c": s["c"],
                "mine": s["lay"].get(str(mine)) if mine is not None else None, "frozen": s["frozen"].get(pid, 0) if pid else 0,
                "left": len(s["deck"]), "last": s["last"], "symbols": SYMBOLS}

    def tick(self, now):
        s = self.s
        if self.over or s["phase"] != "ready" or now < s["deadline"]:
            return []
        for p in self.ids():
            s["cards"][p] = self._deal()
        s["center"] = self._deal()
        s["phase"], s["c"] = "play", 1
        s["turn_no"] += 1
        return [{"e": "go"}]

    def act(self, pid, a, now):
        s = self.s
        if s["phase"] != "play" or a.get("do") != "tap":
            return []
        if int(a.get("c", 0)) != s["c"]:
            return []  # tapped an old middle card — someone was faster
        if s["frozen"].get(pid, 0) > now:
            raise IllegalMove("Tunggu sebentar…")
        sym = int(a.get("sym", -1))
        deck = dobble_deck()
        mine, center = s["cards"].get(pid), s["center"]
        if mine is None or center is None:
            return []
        common = set(deck[mine]) & set(deck[center])
        if sym not in common:
            s["frozen"][pid] = now + 1.6
            self.bump("misses", pid)
            return [{"e": "miss", "who": pid, "sym": sym}]
        s["scores"][pid] += 1
        self.bump("spots", pid)
        s["cards"][pid] = center
        s["last"] = {"who": pid, "sym": sym}
        nxt = self._deal()
        ev = [{"e": "got", "who": pid, "sym": sym}]
        if s["scores"][pid] >= s["target"] or nxt is None:
            self.finish(rank_by_score(self.ids(), s["scores"]))
            return ev + [{"e": "end"}]
        s["center"] = nxt
        s["c"] += 1
        s["turn_no"] += 1
        return ev

