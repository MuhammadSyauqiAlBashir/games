"""Matematika questions (generated, never from AI, so the answers are always right).
Levels: 1 = SD, 2 = SMP, 3 = SMA. Types: arithmetic, sequences (deret), story
problems (soal cerita) and logic. Answers are whole numbers (or a day name)."""

from __future__ import annotations

import math
import random

NAMES = ["Budi", "Siti", "Andi", "Rina", "Dewi", "Joko", "Putri", "Agus", "Lina", "Rizky", "Nadia", "Fajar"]
DAYS_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def rp(n: int) -> str:
    return "Rp" + f"{n:,}".replace(",", ".")


def q(text_id: str, text_en: str, answer, level: int, kind: str, unit: str = "") -> dict:
    return {"id": text_id, "en": text_en, "answer": str(answer), "level": level, "type": kind, "unit": unit}


# ---- arithmetic ---------------------------------------------------------------------------
def arith(level: int, r: random.Random) -> dict:
    if level == 1:
        op = r.choice("+-×÷")
        if op == "+":
            a, b = r.randint(12, 99), r.randint(12, 99)
            return q(f"{a} + {b} = ?", f"{a} + {b} = ?", a + b, 1, "arith")
        if op == "-":
            a, b = r.randint(40, 150), r.randint(10, 39)
            return q(f"{a} − {b} = ?", f"{a} − {b} = ?", a - b, 1, "arith")
        if op == "×":
            a, b = r.randint(3, 12), r.randint(3, 12)
            return q(f"{a} × {b} = ?", f"{a} × {b} = ?", a * b, 1, "arith")
        b, c = r.randint(2, 12), r.randint(2, 12)
        return q(f"{b * c} ÷ {b} = ?", f"{b * c} ÷ {b} = ?", c, 1, "arith")
    if level == 2:
        kind = r.choice(["order", "neg", "pct", "square", "frac"])
        if kind == "order":
            a, b, c = r.randint(2, 9), r.randint(2, 9), r.randint(2, 20)
            return q(f"{c} + {a} × {b} = ?", f"{c} + {a} × {b} = ?", c + a * b, 2, "arith")
        if kind == "neg":
            a, b = r.randint(-30, -5), r.randint(-20, 20)
            return q(f"({a}) − ({b}) = ?", f"({a}) − ({b}) = ?", a - b, 2, "arith")
        if kind == "pct":
            p, n = r.choice([10, 20, 25, 50, 75, 5, 15]), r.choice([40, 80, 120, 200, 360, 400, 1000])
            return q(f"{p}% dari {n} = ?", f"{p}% of {n} = ?", p * n // 100, 2, "arith")
        if kind == "square":
            a = r.randint(11, 25)
            return q(f"{a}² = ?", f"{a}² = ?", a * a, 2, "arith")
        d = r.choice([2, 3, 4, 5, 6])
        n = r.randint(2, 9) * d
        k = r.randint(1, d - 1)
        return q(f"{k}/{d} × {n} = ?", f"{k}/{d} × {n} = ?", k * n // d, 2, "arith")
    kind = r.choice(["eq", "pow", "log", "sqrt", "comb", "sys"])
    if kind == "eq":
        x, a, b = r.randint(-9, 15), r.randint(2, 9), r.randint(-20, 20)
        return q(f"{a}x {'+' if b >= 0 else '−'} {abs(b)} = {a * x + b}. x = ?", f"{a}x {'+' if b >= 0 else '−'} {abs(b)} = {a * x + b}. x = ?", x, 3, "arith")
    if kind == "pow":
        a, n = r.choice([2, 3, 5]), r.randint(3, 7 if r.random() < 0.5 else 5)
        return q(f"{a}^{n} = ?", f"{a}^{n} = ?", a ** n, 3, "arith")
    if kind == "log":
        b, n = r.choice([2, 3, 10]), r.randint(2, 6)
        return q(f"log{'₂' if b == 2 else '₃' if b == 3 else ''} {b ** n} = ?", f"log base {b} of {b ** n} = ?", n, 3, "arith")
    if kind == "sqrt":
        a = r.randint(12, 40)
        return q(f"√{a * a} = ?", f"√{a * a} = ?", a, 3, "arith")
    if kind == "comb":
        n, k = r.randint(5, 9), 2
        return q(f"Kombinasi C({n},{k}) = ?", f"Combination C({n},{k}) = ?", math.comb(n, k), 3, "arith")
    x, y = r.randint(1, 12), r.randint(1, 12)
    return q(f"x + y = {x + y} dan x − y = {x - y}. x × y = ?", f"x + y = {x + y} and x − y = {x - y}. x × y = ?", x * y, 3, "arith")


# ---- sequences --------------------------------------------------------------------------------
def sequence(level: int, r: random.Random) -> dict:
    kinds = {1: ["add", "mul2", "sub"], 2: ["add", "mul", "square", "alt", "tri"], 3: ["fib", "cube", "diff2", "mul_add", "primes"]}[level]
    kind = r.choice(kinds)
    if kind == "add":
        a, d = r.randint(1, 20), r.randint(2, 9)
        seq = [a + d * i for i in range(5)]
    elif kind == "sub":
        a, d = r.randint(60, 99), r.randint(3, 9)
        seq = [a - d * i for i in range(5)]
    elif kind == "mul2":
        a = r.randint(1, 5)
        seq = [a * 2 ** i for i in range(5)]
    elif kind == "mul":
        a, m = r.randint(1, 4), r.choice([3, 4, 5])
        seq = [a * m ** i for i in range(5)]
    elif kind == "square":
        s = r.randint(1, 6)
        seq = [(s + i) ** 2 for i in range(5)]
    elif kind == "alt":
        a, x, y = r.randint(10, 30), r.randint(3, 9), r.randint(1, 5)
        seq, v = [a], a
        for i in range(4):
            v = v + x if i % 2 == 0 else v - y
            seq.append(v)
    elif kind == "tri":
        s = r.randint(1, 4)
        seq = [(s + i) * (s + i + 1) // 2 for i in range(5)]
    elif kind == "fib":
        a, b = r.randint(1, 5), r.randint(2, 7)
        seq = [a, b]
        while len(seq) < 5:
            seq.append(seq[-1] + seq[-2])
    elif kind == "cube":
        s = r.randint(1, 4)
        seq = [(s + i) ** 3 for i in range(5)]
    elif kind == "diff2":
        a, d, dd = r.randint(1, 10), r.randint(1, 5), r.randint(1, 3)
        seq, v = [a], a
        for i in range(4):
            v += d + dd * i
            seq.append(v)
    elif kind == "mul_add":
        a, m, c = r.randint(1, 4), 2, r.randint(1, 3)
        seq = [a]
        while len(seq) < 5:
            seq.append(seq[-1] * m + c)
    else:
        p = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]
        s = r.randint(0, 8)
        seq = p[s:s + 5]
    shown = ", ".join(str(x) for x in seq[:4])
    return q(f"Lanjutkan deret: {shown}, …", f"Continue the sequence: {shown}, …", seq[4], level, "sequence")


# ---- story problems ------------------------------------------------------------------------------
def story(level: int, r: random.Random) -> dict:
    n1, n2 = r.sample(NAMES, 2)
    if level == 1:
        kind = r.choice(["buy", "share", "left", "legs"])
        if kind == "buy":
            k, p = r.randint(2, 6), r.choice([2000, 2500, 3000, 3500, 5000])
            return q(f"{n1} membeli {k} buku seharga {rp(p)} per buku. Berapa rupiah yang dibayar?",
                     f"{n1} buys {k} books at {rp(p)} each. How many rupiah does {n1} pay?", k * p, 1, "story", "Rp")
        if kind == "share":
            k, e = r.randint(2, 6), r.randint(3, 9)
            return q(f"{n1} punya {k * e} permen dibagi rata ke {k} teman. Tiap teman dapat berapa?",
                     f"{n1} shares {k * e} sweets equally among {k} friends. How many does each get?", e, 1, "story")
        if kind == "left":
            a, b = r.randint(20, 60), r.randint(5, 19)
            return q(f"Ada {a} kelereng. {n1} memberi {b} kepada {n2}. Sisa berapa?",
                     f"There are {a} marbles. {n1} gives {b} to {n2}. How many are left?", a - b, 1, "story")
        c, g = r.randint(2, 9), r.randint(2, 9)
        return q(f"Di kandang ada {c} ayam dan {g} kambing. Berapa jumlah kaki semuanya?",
                 f"A farm has {c} chickens and {g} goats. How many legs in total?", c * 2 + g * 4, 1, "story")
    if level == 2:
        kind = r.choice(["discount", "speed", "age", "avg", "work"])
        if kind == "discount":
            p, d = r.choice([80000, 120000, 150000, 200000, 250000]), r.choice([10, 20, 25, 30, 50])
            return q(f"Baju seharga {rp(p)} didiskon {d}%. Berapa harga setelah diskon?",
                     f"A shirt costs {rp(p)} with {d}% off. What is the price after the discount?", p * (100 - d) // 100, 2, "story", "Rp")
        if kind == "speed":
            v, t = r.choice([40, 50, 60, 80]), r.choice([2, 3, 4])
            return q(f"Mobil melaju {v} km/jam selama {t} jam. Berapa km jarak yang ditempuh?",
                     f"A car drives at {v} km/h for {t} hours. How many km does it travel?", v * t, 2, "story", "km")
        if kind == "age":
            a, diff = r.randint(8, 15), r.randint(20, 30)
            return q(f"Umur ayah {n1} {diff} tahun lebih tua dari {n1}. Jumlah umur mereka {2 * a + diff}. Berapa umur {n1}?",
                     f"{n1}'s father is {diff} years older than {n1}. Their ages add up to {2 * a + diff}. How old is {n1}?", a, 2, "story")
        if kind == "avg":
            vals = [r.randint(60, 95) for _ in range(3)]
            total = sum(vals) + (-sum(vals)) % 4
            last = total - sum(vals)
            if last < 50:
                last += 4
                total += 4
            return q(f"Nilai {n1}: {vals[0]}, {vals[1]}, {vals[2]}. Berapa nilai ujian ke-4 agar rata-ratanya {total // 4}?",
                     f"{n1}'s scores: {vals[0]}, {vals[1]}, {vals[2]}. What 4th score makes the average {total // 4}?", last, 2, "story")
        w, d = r.choice([(4, 12), (6, 10), (3, 8), (5, 12)])
        return q(f"{w} tukang menyelesaikan rumah dalam {d} hari. Jika {w * 2} tukang, berapa hari?",
                 f"{w} builders finish a house in {d} days. How many days for {w * 2} builders?", d // 2, 2, "story")
    kind = r.choice(["interest", "mix", "handshake", "clock", "chicken"])
    if kind == "interest":
        p, i, y = r.choice([1000000, 2000000, 5000000]), r.choice([5, 6, 10]), r.choice([2, 3])
        return q(f"Tabungan {rp(p)} dengan bunga tunggal {i}% per tahun. Berapa total setelah {y} tahun?",
                 f"Savings of {rp(p)} earn {i}% simple interest per year. What is the total after {y} years?",
                 p + p * i * y // 100, 3, "story", "Rp")
    if kind == "mix":
        a, b = r.randint(2, 5), r.randint(2, 5)
        pa, pb = r.choice([10000, 12000, 15000]), r.choice([20000, 25000, 30000])
        return q(f"{n1} membeli {a} kg beras @{rp(pa)} dan {b} kg gula @{rp(pb)}. Bayar dengan Rp200.000, kembaliannya?",
                 f"{n1} buys {a} kg rice at {rp(pa)} and {b} kg sugar at {rp(pb)}, paying Rp200.000. How much change?",
                 200000 - a * pa - b * pb, 3, "story", "Rp")
    if kind == "handshake":
        n = r.randint(5, 12)
        return q(f"{n} orang saling berjabat tangan tepat sekali. Berapa jabat tangan?",
                 f"{n} people each shake hands once with everyone. How many handshakes?", n * (n - 1) // 2, 3, "story")
    if kind == "clock":
        d, n = r.randint(0, 6), r.choice([10, 15, 30, 45, 100])
        return q(f"Hari ini {DAYS_ID[d]}. {n} hari lagi hari apa?", f"Today is {DAYS_EN[d]}. What day is it in {n} days?",
                 f"{DAYS_ID[(d + n) % 7]}|{DAYS_EN[(d + n) % 7]}", 3, "logic")
    heads = r.randint(10, 30)
    goats = r.randint(2, heads - 2)
    legs = goats * 4 + (heads - goats) * 2
    return q(f"Ada ayam dan kambing: {heads} kepala dan {legs} kaki. Berapa kambingnya?",
             f"Chickens and goats: {heads} heads and {legs} legs. How many goats?", goats, 3, "story")


def logic(level: int, r: random.Random) -> dict:
    kind = r.choice(["missing", "clock", "odd"])
    if kind == "missing":
        a, b = r.randint(2, 9), r.randint(2, 9)
        c = r.randint(2, 9)
        return q(f"Jika {a} ★ {b} = {a * b + a}, maka {c} ★ {b} = ?", f"If {a} ★ {b} = {a * b + a}, then {c} ★ {b} = ?",
                 c * b + c, max(2, level), "logic")
    if kind == "clock":
        h = r.randint(1, 11)
        return q(f"Jam menunjukkan pukul {h}:00. Berapa derajat sudut kecil antara jarum jam dan menit?",
                 f"It's {h}:00. What is the smaller angle between the clock hands, in degrees?", min(30 * h, 360 - 30 * h),
                 max(2, level), "logic", "°")
    n = r.randint(3, 8)
    return q(f"Sebuah kue dipotong dengan {n} potongan lurus melewati tengah. Paling banyak jadi berapa potong?",
             f"A cake is cut with {n} straight cuts through the centre. What's the maximum number of pieces?", 2 * n,
             max(2, level), "logic")


GENERATORS = {"arith": arith, "sequence": sequence, "story": story, "logic": logic}


def make(n: int, levels: list[int], types: list[str], r: random.Random) -> list[dict]:
    types = [t for t in types if t in GENERATORS] or list(GENERATORS)
    out, seen = [], set()
    for i in range(n):
        lv = levels[i] if i < len(levels) else levels[-1]
        for _ in range(30):
            item = GENERATORS[r.choice(types)](lv, r)
            if item["id"] not in seen:
                break
        seen.add(item["id"])
        out.append(item)
    return out
