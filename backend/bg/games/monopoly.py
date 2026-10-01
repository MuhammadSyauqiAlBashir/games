"""Monopoly — official rules on a world-cities board, money in Rupiah (official × 10.000).

Official: GO pays Rp2jt; unowned property is bought or auctioned; rent doubles on an
unimproved full colour set; houses must be built evenly (32 houses / 12 hotels in the
bank); mortgage at half price, lift for mortgage + 10%; jail (pay Rp500rb, use a card,
or roll doubles within 3 turns); three doubles in a row send you to jail; Chance and
Community Chest decks; debts must be paid by selling houses / mortgaging or you go bankrupt
(to a player: they get everything; to the bank: properties return to the bank).
Room options: Official (last one standing) or Fast (time limit, richest net worth wins),
and the popular Free Parking jackpot house rule."""

from __future__ import annotations

from .base import Game, IllegalMove, ch, opt

K = 10_000  # official dollar → Rupiah
GO_SALARY = 200 * K
JAIL_FINE = 50 * K
START_CASH = 1500 * K

# (square, name, group, price, rents [base, 1h, 2h, 3h, 4h, hotel], house cost)
STREETS = [
    (1, "Yogyakarta", "brown", 60, [2, 10, 30, 90, 160, 250], 50),
    (3, "Bandung", "brown", 60, [4, 20, 60, 180, 320, 450], 50),
    (6, "Hanoi", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50),
    (8, "Bangkok", "lightblue", 100, [6, 30, 90, 270, 400, 550], 50),
    (9, "Kuala Lumpur", "lightblue", 120, [8, 40, 100, 300, 450, 600], 50),
    (11, "Cairo", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
    (13, "Mumbai", "pink", 140, [10, 50, 150, 450, 625, 750], 100),
    (14, "Istanbul", "pink", 160, [12, 60, 180, 500, 700, 900], 100),
    (16, "Mexico City", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
    (18, "Buenos Aires", "orange", 180, [14, 70, 200, 550, 750, 950], 100),
    (19, "Rio de Janeiro", "orange", 200, [16, 80, 220, 600, 800, 1000], 100),
    (21, "Seoul", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
    (23, "Sydney", "red", 220, [18, 90, 250, 700, 875, 1050], 150),
    (24, "Singapore", "red", 240, [20, 100, 300, 750, 925, 1100], 150),
    (26, "Barcelona", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
    (27, "Rome", "yellow", 260, [22, 110, 330, 800, 975, 1150], 150),
    (29, "Dubai", "yellow", 280, [24, 120, 360, 850, 1025, 1200], 150),
    (31, "Amsterdam", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
    (32, "Berlin", "green", 300, [26, 130, 390, 900, 1100, 1275], 200),
    (34, "Paris", "green", 320, [28, 150, 450, 1000, 1200, 1400], 200),
    (37, "New York", "darkblue", 350, [35, 175, 500, 1100, 1300, 1500], 200),
    (39, "Tokyo", "darkblue", 400, [50, 200, 600, 1400, 1700, 2000], 200),
]
AIRPORTS = [(5, "Soekarno-Hatta"), (15, "Changi"), (25, "Heathrow"), (35, "JFK")]
UTILITIES = [(12, "PLN (Listrik)"), (28, "PDAM (Air)")]

SQUARES: list[dict] = []
for _i in range(40):
    SQUARES.append({"i": _i, "type": "other", "name": ""})
SQUARES[0].update(type="go", name="GO")
SQUARES[10].update(type="jail", name="Penjara / Jail")
SQUARES[20].update(type="parking", name="Parkir Bebas / Free Parking")
SQUARES[30].update(type="gotojail", name="Masuk Penjara / Go to Jail")
SQUARES[4].update(type="tax", name="Pajak Penghasilan / Income Tax", amount=200 * K)
SQUARES[38].update(type="tax", name="Pajak Barang Mewah / Luxury Tax", amount=100 * K)
for _i in (7, 22, 36):
    SQUARES[_i].update(type="chance", name="Kesempatan / Chance")
for _i in (2, 17, 33):
    SQUARES[_i].update(type="chest", name="Dana Umum / Community Chest")
for sq, name, group, price, rents, house in STREETS:
    SQUARES[sq].update(type="street", name=name, group=group, price=price * K, rents=[r * K for r in rents],
                       house=house * K)
for sq, name in AIRPORTS:
    SQUARES[sq].update(type="airport", name=name, group="airport", price=200 * K)
for sq, name in UTILITIES:
    SQUARES[sq].update(type="utility", name=name, group="utility", price=150 * K)
GROUPS: dict[str, list[int]] = {}
for _s in SQUARES:
    if _s.get("group"):
        GROUPS.setdefault(_s["group"], []).append(_s["i"])

CHANCE = [
    ("Maju ke Tokyo.", "Advance to Tokyo.", ("goto", 39)),
    ("Maju ke GO (terima Rp2jt).", "Advance to GO (collect Rp2m).", ("goto", 0)),
    ("Maju ke Singapore. Lewat GO? Terima Rp2jt.", "Advance to Singapore. Pass GO? Collect Rp2m.", ("goto", 24)),
    ("Maju ke Cairo. Lewat GO? Terima Rp2jt.", "Advance to Cairo. Pass GO? Collect Rp2m.", ("goto", 11)),
    ("Maju ke bandara terdekat; bayar pemilik 2× sewa.", "Advance to the nearest airport; pay the owner twice the rent.", ("nearest", "airport")),
    ("Maju ke bandara terdekat; bayar pemilik 2× sewa.", "Advance to the nearest airport; pay the owner twice the rent.", ("nearest", "airport")),
    ("Maju ke utilitas terdekat; bayar 10× dadu jika dimiliki.", "Advance to the nearest utility; if owned pay 10× the dice.", ("nearest", "utility")),
    ("Bank membayar dividen Rp500rb.", "Bank pays you a dividend of Rp500k.", ("money", 50 * K)),
    ("Kartu Bebas Penjara.", "Get Out of Jail Free.", ("jailcard", "chance")),
    ("Mundur 3 langkah.", "Go back 3 spaces.", ("back", 3)),
    ("Masuk penjara!", "Go to jail!", ("jail",)),
    ("Perbaikan rumah: Rp250rb per rumah, Rp1jt per hotel.", "General repairs: Rp250k per house, Rp1m per hotel.", ("repairs", 25 * K, 100 * K)),
    ("Denda ngebut Rp150rb.", "Speeding fine Rp150k.", ("money", -15 * K)),
    ("Terbang ke Soekarno-Hatta. Lewat GO? Terima Rp2jt.", "Take a trip to Soekarno-Hatta. Pass GO? Collect Rp2m.", ("goto", 5)),
    ("Kamu jadi ketua: bayar tiap pemain Rp500rb.", "Chairman of the board: pay each player Rp500k.", ("each", -50 * K)),
    ("Pinjaman bangunan cair: terima Rp1,5jt.", "Your building loan matures: collect Rp1.5m.", ("money", 150 * K)),
]
CHEST = [
    ("Maju ke GO (terima Rp2jt).", "Advance to GO (collect Rp2m).", ("goto", 0)),
    ("Bank salah hitung: terima Rp2jt.", "Bank error in your favour: collect Rp2m.", ("money", 200 * K)),
    ("Biaya dokter Rp500rb.", "Doctor's fee Rp500k.", ("money", -50 * K)),
    ("Jual saham: terima Rp500rb.", "Sale of stock: collect Rp500k.", ("money", 50 * K)),
    ("Kartu Bebas Penjara.", "Get Out of Jail Free.", ("jailcard", "chest")),
    ("Masuk penjara!", "Go to jail!", ("jail",)),
    ("Dana liburan cair: terima Rp1jt.", "Holiday fund matures: collect Rp1m.", ("money", 100 * K)),
    ("Restitusi pajak: terima Rp200rb.", "Income tax refund: collect Rp200k.", ("money", 20 * K)),
    ("Ulang tahunmu! Terima Rp100rb dari tiap pemain.", "It's your birthday! Collect Rp100k from every player.", ("each", 10 * K)),
    ("Asuransi jiwa cair: terima Rp1jt.", "Life insurance matures: collect Rp1m.", ("money", 100 * K)),
    ("Biaya rumah sakit Rp1jt.", "Hospital fees Rp1m.", ("money", -100 * K)),
    ("Biaya sekolah Rp500rb.", "School fees Rp500k.", ("money", -50 * K)),
    ("Fee konsultasi: terima Rp250rb.", "Consultancy fee: collect Rp250k.", ("money", 25 * K)),
    ("Perbaikan jalan: Rp400rb per rumah, Rp1,15jt per hotel.", "Street repairs: Rp400k per house, Rp1.15m per hotel.", ("repairs", 40 * K, 115 * K)),
    ("Juara 2 kontes kecantikan: terima Rp100rb.", "Second prize in a beauty contest: collect Rp100k.", ("money", 10 * K)),
    ("Dapat warisan Rp1jt.", "You inherit Rp1m.", ("money", 100 * K)),
]


class Monopoly(Game):
    key, name_id, name_en, icon = "monopoly", "Monopoly", "Monopoly", "🏦"
    min_players, max_players = 2, 6
    santai_ok = True
    default_timer = 90
    options = [
        opt("mode", "Mode", "Mode", "select", "official",
            [ch("official", "Resmi (sampai satu tersisa)", "Official (last one standing)"),
             ch("fast", "Cepat (batas waktu, terkaya menang)", "Fast (time limit, richest wins)")]),
        opt("minutes", "Batas waktu (mode cepat)", "Time limit (fast mode)", "select", 60,
            [ch(30, "30 menit", "30 min"), ch(45, "45 menit", "45 min"), ch(60, "60 menit", "60 min"), ch(90, "90 menit", "90 min")]),
        opt("parking", "Jackpot Parkir Bebas", "Free Parking jackpot", "bool", False,
            help_id="Pajak & denda masuk ke tengah; yang berhenti di Parkir Bebas mengambilnya.",
            help_en="Taxes and fines go to the middle; landing on Free Parking takes it."),
    ]

    @classmethod
    def setup(cls, players, options, rng, now):
        ids = [p["id"] for p in players]
        chance = list(range(len(CHANCE)))
        chest = list(range(len(CHEST)))
        rng.shuffle(chance)
        rng.shuffle(chest)
        return {
            "players": players, "cash": {p: START_CASH for p in ids}, "pos": {p: 0 for p in ids},
            "jail": {p: -1 for p in ids}, "jailcards": {p: [] for p in ids}, "bankrupt": [],
            "props": {str(s["i"]): {"owner": None, "houses": 0, "mort": False} for s in SQUARES if s.get("price")},
            "houses": 32, "hotels": 12, "chance": chance, "chest": chest, "doubles": 0, "dice": None,
            "turn": ids[0], "turn_no": 1, "phase": "roll", "pending": None, "auction": None, "trade": None,
            "debt": None, "card": None, "pot": 0, "log": [], "mode": options.get("mode", "official"),
            "ends_at": (int(options.get("minutes", 60)) * 60) if options.get("mode") == "fast" else None,
            "parking_rule": bool(options.get("parking")), "again": False,
        }

    # ---- helpers ------------------------------------------------------------------------------
    def owner(self, sq: int):
        p = self.s["props"].get(str(sq))
        return p["owner"] if p else None

    def owns_group(self, pid, group) -> bool:
        return all(self.owner(i) == pid for i in GROUPS[group])

    def net_worth(self, pid) -> int:
        s = self.s
        total = s["cash"][pid]
        for sq, p in s["props"].items():
            if p["owner"] == pid:
                info = SQUARES[int(sq)]
                total += info["price"] // 2 if p["mort"] else info["price"]
                if p["houses"]:
                    total += p["houses"] * info.get("house", 0)
        return total

    def active(self) -> list[str]:
        return [p for p in self.ids() if p not in self.s["bankrupt"]]

    def log(self, text_id, text_en=None):
        self.s["log"].append({"id": text_id, "en": text_en or text_id})
        self.s["log"] = self.s["log"][-30:]

    def rp(self, n: int) -> str:
        return "Rp" + f"{int(n):,}".replace(",", ".")

    def rent(self, sq: int, dice_total: int, multiplier: int = 1) -> int:
        info, p = SQUARES[sq], self.s["props"][str(sq)]
        if p["mort"] or not p["owner"]:
            return 0
        owner = p["owner"]
        if info["type"] == "street":
            if p["houses"]:
                return info["rents"][p["houses"]]
            base = info["rents"][0]
            return base * 2 if self.owns_group(owner, info["group"]) else base
        if info["type"] == "airport":
            n = sum(1 for i in GROUPS["airport"] if self.owner(i) == owner)
            return 25 * K * (2 ** (n - 1)) * multiplier
        if info["type"] == "utility":
            n = sum(1 for i in GROUPS["utility"] if self.owner(i) == owner)
            factor = 10 if (n == 2 or multiplier == 10) else 4
            return dice_total * factor * K
        return 0

    # ---- view -------------------------------------------------------------------------------------
    def view(self, pid):
        s = self.s
        return {**self.base_view(), "squares": SQUARES, "cash": s["cash"], "pos": s["pos"], "jail": s["jail"],
                "jailcards": {p: len(c) for p, c in s["jailcards"].items()}, "bankrupt": s["bankrupt"],
                "props": s["props"], "houses": s["houses"], "hotels": s["hotels"], "dice": s["dice"],
                "phase": s["phase"], "pending": s["pending"], "auction": s["auction"], "trade": s["trade"],
                "debt": s["debt"], "card": s["card"], "pot": s["pot"], "log": s["log"][-12:], "mode": s["mode"],
                "ends_at": s["ends_at"], "worth": {p: self.net_worth(p) for p in self.ids()}, "again": s["again"],
                "parking_rule": s["parking_rule"]}

    def turn(self):
        s = self.s
        if self.over:
            return []
        if s["phase"] == "auction" and s["auction"]:
            return [p for p in self.active()]
        if s["trade"]:
            return [s["trade"]["to"]]
        if s["phase"] == "debt" and s["debt"]:
            return [s["debt"]["who"]]
        return [s["turn"]] if s["turn"] else []

    # ---- actions ---------------------------------------------------------------------------------------
    def act(self, pid, a, now):
        s = self.s
        do = a.get("do")
        if self.over:
            raise IllegalMove("The game is over.")
        if pid in s["bankrupt"]:
            raise IllegalMove("You're out of the game.")
        if do == "bid":
            return self._bid(pid, int(a.get("amount", 0)), now)
        if do in ("trade_accept", "trade_reject"):
            return self._trade_answer(pid, do == "trade_accept")
        if s["phase"] == "debt":
            if pid != s["debt"]["who"]:
                raise IllegalMove("Waiting for a player to pay their debt.")
            if do in ("sell", "mortgage", "unmortgage", "build"):
                return self._manage(pid, do, int(a.get("sq", -1)))
            if do == "pay_debt":
                return self._pay_debt(pid)
            if do == "bankrupt":
                return self._bankrupt(pid, s["debt"]["to"])
            raise IllegalMove("Raise money: sell houses or mortgage properties.")
        if pid != s["turn"]:
            raise IllegalMove("Not your turn.")
        if s["trade"]:
            if do == "trade_cancel":
                s["trade"] = None
                s["turn_no"] += 1
                return [{"e": "trade_cancel"}]
            raise IllegalMove("Waiting for the trade answer.")
        if do == "roll":
            if s["phase"] not in ("roll", "jail"):
                raise IllegalMove("You can't roll now.")
            return self._roll(pid, now)
        if do == "jail_pay":
            return self._jail_pay(pid)
        if do == "jail_card":
            return self._jail_card(pid)
        if do == "buy":
            return self._buy(pid)
        if do == "auction":
            if s["phase"] != "buy":
                raise IllegalMove("Nothing to auction.")
            return self._start_auction(s["pending"]["sq"], now)
        if do in ("build", "sell", "mortgage", "unmortgage"):
            if s["phase"] not in ("roll", "manage", "jail"):
                raise IllegalMove("Finish the current step first.")
            return self._manage(pid, do, int(a.get("sq", -1)))
        if do == "trade":
            if s["phase"] not in ("roll", "manage", "jail"):
                raise IllegalMove("You can trade before rolling or after your move.")
            return self._trade_offer(pid, a)
        if do == "end":
            if s["phase"] != "manage":
                raise IllegalMove("You can't end your turn yet.")
            return self._end_turn(pid)
        raise IllegalMove("Unknown action.")

    # ---- dice and moving ---------------------------------------------------------------------------------
    def _roll(self, pid, now):
        s = self.s
        d1, d2 = self.rng.randint(1, 6), self.rng.randint(1, 6)
        s["dice"] = [d1, d2]
        doubles = d1 == d2
        ev = [{"e": "roll", "who": pid, "v": [d1, d2]}]
        if s["jail"][pid] >= 0:
            if doubles:
                s["jail"][pid] = -1
                self.log(f"{self.name(pid)} lolos dari penjara dengan double!", f"{self.name(pid)} rolls doubles and leaves jail!")
                s["again"] = False  # leaving jail with doubles doesn't give another roll
                return ev + self._move(pid, d1 + d2, now)
            s["jail"][pid] += 1
            if s["jail"][pid] >= 3:
                self.log(f"{self.name(pid)} membayar denda setelah 3 giliran.", f"{self.name(pid)} pays the fine after 3 turns.")
                s["jail"][pid] = -1
                ev += self._pay(pid, None, JAIL_FINE, "jail")
                if s["phase"] == "debt":
                    s["debt"]["then_move"] = d1 + d2
                    return ev
                return ev + self._move(pid, d1 + d2, now)
            s["phase"] = "manage"
            s["again"] = False
            s["turn_no"] += 1
            return ev
        if doubles:
            s["doubles"] += 1
            if s["doubles"] >= 3:
                self.bump("jailed", pid)
                self.log(f"{self.name(pid)} dapat 3× double — masuk penjara!", f"{self.name(pid)} rolled 3 doubles — go to jail!")
                return ev + self._to_jail(pid)
        s["again"] = doubles
        return ev + self._move(pid, d1 + d2, now)

    def _move(self, pid, steps, now, collect=True):
        s = self.s
        start = s["pos"][pid]
        new = (start + steps) % 40
        if collect and start + steps >= 40:
            s["cash"][pid] += GO_SALARY
            self.log(f"{self.name(pid)} lewat GO: +{self.rp(GO_SALARY)}", f"{self.name(pid)} passes GO: +{self.rp(GO_SALARY)}")
        s["pos"][pid] = new
        return [{"e": "move", "who": pid, "from": start, "to": new}] + self._land(pid, now)

    def _goto(self, pid, target, now, collect=True):
        s = self.s
        start = s["pos"][pid]
        steps = (target - start) % 40
        return self._move(pid, steps, now, collect)

    def _to_jail(self, pid):
        s = self.s
        s["pos"][pid] = 10
        s["jail"][pid] = 0
        s["doubles"] = 0
        s["again"] = False
        s["phase"] = "manage"
        s["turn_no"] += 1
        return [{"e": "jail", "who": pid}]

    def _land(self, pid, now, multiplier=1):
        s = self.s
        sq = s["pos"][pid]
        info = SQUARES[sq]
        t = info["type"]
        s["phase"] = "manage"
        s["turn_no"] += 1
        if t in ("street", "airport", "utility"):
            owner = self.owner(sq)
            if owner is None:
                s["phase"] = "buy"
                s["pending"] = {"sq": sq}
                return []
            if owner != pid and owner not in s["bankrupt"]:
                total = sum(s["dice"] or [0])
                if multiplier == 10 and info["type"] == "utility":
                    amount = total * 10 * K
                else:
                    amount = self.rent(sq, total, multiplier)
                if amount:
                    self.log(f"{self.name(pid)} bayar sewa {self.rp(amount)} ke {self.name(owner)} ({info['name']})",
                             f"{self.name(pid)} pays {self.rp(amount)} rent to {self.name(owner)} ({info['name']})")
                    self.bump("rent_paid", pid, amount)
                    self.bump("rent_got", owner, amount)
                    return [{"e": "rent", "who": pid, "to": owner, "amount": amount, "sq": sq}] + \
                        self._pay(pid, owner, amount, "rent")
            return []
        if t == "tax":
            self.log(f"{self.name(pid)} bayar {info['name'].split(' / ')[0]} {self.rp(info['amount'])}",
                     f"{self.name(pid)} pays {info['name'].split(' / ')[-1]} {self.rp(info['amount'])}")
            return self._pay(pid, None, info["amount"], "tax")
        if t == "gotojail":
            self.bump("jailed", pid)
            return self._to_jail(pid)
        if t == "parking" and s["parking_rule"] and s["pot"]:
            got = s["pot"]
            s["cash"][pid] += got
            s["pot"] = 0
            self.log(f"{self.name(pid)} dapat jackpot parkir {self.rp(got)}!", f"{self.name(pid)} wins the parking jackpot {self.rp(got)}!")
            return [{"e": "jackpot", "who": pid, "amount": got}]
        if t in ("chance", "chest"):
            return self._card(pid, t, now)
        return []

    def _card(self, pid, deck_name, now):
        s = self.s
        deck = s[deck_name]
        idx = deck.pop(0)
        cards = CHANCE if deck_name == "chance" else CHEST
        text_id, text_en, eff = cards[idx]
        if eff[0] != "jailcard":
            deck.append(idx)
        s["card"] = {"deck": deck_name, "id": text_id, "en": text_en, "who": pid}
        self.log(f"{self.name(pid)}: {text_id}", f"{self.name(pid)}: {text_en}")
        ev = [{"e": "card", "who": pid, "deck": deck_name, "id": text_id, "en": text_en}]
        kind = eff[0]
        if kind == "goto":
            return ev + self._goto(pid, eff[1], now)
        if kind == "nearest":
            pos = s["pos"][pid]
            targets = GROUPS[eff[1]]
            target = min(targets, key=lambda t: (t - pos) % 40 or 40)
            s["cash"][pid] += GO_SALARY if target < pos else 0
            s["pos"][pid] = target
            ev.append({"e": "move", "who": pid, "from": pos, "to": target})
            return ev + self._land(pid, now, multiplier=2 if eff[1] == "airport" else 10)
        if kind == "money":
            if eff[1] >= 0:
                s["cash"][pid] += eff[1]
                return ev
            return ev + self._pay(pid, None, -eff[1], "card")
        if kind == "jailcard":
            s["jailcards"][pid].append(deck_name)
            return ev
        if kind == "back":
            s["pos"][pid] = (s["pos"][pid] - eff[1]) % 40
            ev.append({"e": "move", "who": pid, "back": True, "to": s["pos"][pid]})
            return ev + self._land(pid, now)
        if kind == "jail":
            self.bump("jailed", pid)
            return ev + self._to_jail(pid)
        if kind == "repairs":
            houses = hotels = 0
            for p in s["props"].values():
                if p["owner"] == pid:
                    if p["houses"] == 5:
                        hotels += 1
                    else:
                        houses += p["houses"]
            cost = houses * eff[1] + hotels * eff[2]
            return ev + (self._pay(pid, None, cost, "card") if cost else [])
        if kind == "each":
            amount = eff[1]
            others = [p for p in self.active() if p != pid]
            if amount < 0:  # pay each player
                total = -amount * len(others)
                if s["cash"][pid] >= total:
                    for o in others:
                        s["cash"][pid] += amount
                        s["cash"][o] -= amount
                    return ev
                return ev + self._pay(pid, None, total, "card", split=others)
            for o in others:  # collect from each player
                got = min(amount, s["cash"][o])
                s["cash"][o] -= got
                s["cash"][pid] += got
            return ev
        return ev

    # ---- paying ------------------------------------------------------------------------------------------
    def _pay(self, pid, to, amount, why, split=None):
        s = self.s
        if s["cash"][pid] >= amount:
            s["cash"][pid] -= amount
            if to:
                s["cash"][to] += amount
            elif split:
                for o in split:
                    s["cash"][o] += amount // len(split)
            elif s["parking_rule"] and why in ("tax", "card", "jail"):
                s["pot"] += amount
            return []
        # Not enough cash: the player must raise money or go bankrupt.
        s["debt"] = {"who": pid, "to": to, "amount": amount, "why": why, "split": split,
                     "resume": s["phase"] if s["phase"] != "debt" else "manage"}
        s["phase"] = "debt"
        s["turn_no"] += 1
        return [{"e": "debt", "who": pid, "amount": amount}]

    def _pay_debt(self, pid):
        s = self.s
        d = s["debt"]
        if s["cash"][pid] < d["amount"]:
            raise IllegalMove("Not enough cash yet — sell houses or mortgage properties.")
        s["debt"] = None
        s["phase"] = d["resume"] if d["resume"] not in ("debt", "buy") else "manage"
        s["turn_no"] += 1
        ev = self._pay(pid, d["to"], d["amount"], d["why"], d.get("split"))
        if d.get("then_move") is not None:
            return ev + self._move(pid, d["then_move"], 0)
        return ev

    def _bankrupt(self, pid, creditor):
        s = self.s
        s["bankrupt"].append(pid)
        self.bump("bankrupt", pid)
        for sq, p in s["props"].items():
            if p["owner"] == pid:
                if p["houses"]:
                    if p["houses"] == 5:
                        s["hotels"] += 1
                    else:
                        s["houses"] += p["houses"]
                    p["houses"] = 0
                if creditor and creditor not in s["bankrupt"]:
                    p["owner"] = creditor
                else:
                    p["owner"], p["mort"] = None, False
        if creditor:
            s["cash"][creditor] += s["cash"][pid]
            s["jailcards"][creditor] += s["jailcards"][pid]
        s["cash"][pid] = 0
        s["jailcards"][pid] = []
        s["debt"] = None
        self.log(f"{self.name(pid)} bangkrut!", f"{self.name(pid)} is bankrupt!")
        ev = [{"e": "bankrupt", "who": pid, "to": creditor}]
        if len(self.active()) <= 1:
            self._final()
            return ev
        if s["turn"] == pid:
            s["doubles"] = 0
            s["again"] = False
            return ev + self._next_player(pid)
        s["phase"] = "manage"
        s["turn_no"] += 1
        return ev

    def _final(self):
        s = self.s
        alive = sorted(self.active(), key=lambda p: -self.net_worth(p))
        worth = {p: self.net_worth(p) for p in self.ids()}
        self.finish([[p] for p in alive] + [[p] for p in reversed(s["bankrupt"])], worth)

    # ---- buying / auctions ----------------------------------------------------------------------------------
    def _buy(self, pid):
        s = self.s
        if s["phase"] != "buy":
            raise IllegalMove("Nothing to buy.")
        sq = s["pending"]["sq"]
        price = SQUARES[sq]["price"]
        if s["cash"][pid] < price:
            raise IllegalMove("Not enough cash — auction it or raise money first.")
        s["cash"][pid] -= price
        s["props"][str(sq)]["owner"] = pid
        s["pending"] = None
        s["phase"] = "manage"
        s["turn_no"] += 1
        self.bump("bought", pid)
        self.log(f"{self.name(pid)} membeli {SQUARES[sq]['name']} ({self.rp(price)})",
                 f"{self.name(pid)} buys {SQUARES[sq]['name']} ({self.rp(price)})")
        return [{"e": "buy", "who": pid, "sq": sq}]

    def _start_auction(self, sq, now):
        s = self.s
        s["pending"] = None
        s["phase"] = "auction"
        s["auction"] = {"sq": sq, "bid": 0, "by": None, "ends": now + 12}
        s["turn_no"] += 1
        self.log(f"Lelang: {SQUARES[sq]['name']}", f"Auction: {SQUARES[sq]['name']}")
        return [{"e": "auction", "sq": sq}]

    def _bid(self, pid, amount, now):
        s = self.s
        au = s["auction"]
        if s["phase"] != "auction" or not au:
            raise IllegalMove("No auction running.")
        if amount < max(10 * K, au["bid"] + 10 * K):
            raise IllegalMove(f"Bid at least {self.rp(max(10 * K, au['bid'] + 10 * K))}.")
        if amount > s["cash"][pid]:
            raise IllegalMove("You don't have that much cash.")
        au.update({"bid": amount, "by": pid, "ends": max(au["ends"], now + 8)})
        return [{"e": "bid", "who": pid, "amount": amount}]

    def tick(self, now):
        s = self.s
        if self.over:
            return []
        if s["ends_at"] and now >= s["ends_at"] and s["phase"] not in ("auction", "debt"):
            self.log("Waktu habis! Pemain terkaya menang.", "Time's up! The richest player wins.")
            self._final()
            return [{"e": "timeup"}]
        au = s["auction"]
        if s["phase"] == "auction" and au and now >= au["ends"]:
            sq = au["sq"]
            s["auction"] = None
            s["phase"] = "manage"
            s["turn_no"] += 1
            if au["by"]:
                s["cash"][au["by"]] -= au["bid"]
                s["props"][str(sq)]["owner"] = au["by"]
                self.log(f"{self.name(au['by'])} memenangkan lelang {SQUARES[sq]['name']} ({self.rp(au['bid'])})",
                         f"{self.name(au['by'])} wins the auction for {SQUARES[sq]['name']} ({self.rp(au['bid'])})")
                return [{"e": "sold", "who": au["by"], "sq": sq, "amount": au["bid"]}]
            self.log("Tidak ada penawar.", "No bids.")
            return [{"e": "unsold", "sq": sq}]
        if s["trade"] and now >= s["trade"]["ends"]:
            s["trade"] = None
            s["turn_no"] += 1
            return [{"e": "trade_expired"}]
        return []

    # ---- houses, mortgages -------------------------------------------------------------------------------------
    def _manage(self, pid, do, sq):
        s = self.s
        p = s["props"].get(str(sq))
        if not p or p["owner"] != pid:
            raise IllegalMove("That's not your property.")
        info = SQUARES[sq]
        group = info.get("group")
        if do == "mortgage":
            if p["mort"]:
                raise IllegalMove("Already mortgaged.")
            if any(s["props"][str(i)]["houses"] for i in GROUPS[group]):
                raise IllegalMove("Sell the houses in this colour set first.")
            p["mort"] = True
            s["cash"][pid] += info["price"] // 2
            self.log(f"{self.name(pid)} menggadaikan {info['name']}", f"{self.name(pid)} mortgages {info['name']}")
        elif do == "unmortgage":
            if not p["mort"]:
                raise IllegalMove("Not mortgaged.")
            cost = info["price"] // 2 * 11 // 10
            if s["cash"][pid] < cost:
                raise IllegalMove("Not enough cash.")
            s["cash"][pid] -= cost
            p["mort"] = False
            self.log(f"{self.name(pid)} menebus {info['name']}", f"{self.name(pid)} lifts the mortgage on {info['name']}")
        elif do == "build":
            if info["type"] != "street" or not self.owns_group(pid, group):
                raise IllegalMove("You need the whole colour set to build.")
            if any(s["props"][str(i)]["mort"] for i in GROUPS[group]):
                raise IllegalMove("Lift the mortgages in this colour set first.")
            if p["houses"] >= 5:
                raise IllegalMove("Already a hotel.")
            if p["houses"] > min(s["props"][str(i)]["houses"] for i in GROUPS[group]):
                raise IllegalMove("Build evenly across the colour set.")
            if s["cash"][pid] < info["house"]:
                raise IllegalMove("Not enough cash.")
            if p["houses"] == 4:
                if s["hotels"] < 1:
                    raise IllegalMove("The bank has no hotels left.")
                s["hotels"] -= 1
                s["houses"] += 4
            else:
                if s["houses"] < 1:
                    raise IllegalMove("The bank has no houses left.")
                s["houses"] -= 1
            s["cash"][pid] -= info["house"]
            p["houses"] += 1
            self.bump("built", pid)
            self.log(f"{self.name(pid)} membangun di {info['name']}", f"{self.name(pid)} builds on {info['name']}")
        elif do == "sell":
            if not p["houses"]:
                raise IllegalMove("No houses to sell.")
            if p["houses"] < max(s["props"][str(i)]["houses"] for i in GROUPS[group]):
                raise IllegalMove("Sell evenly across the colour set.")
            if p["houses"] == 5:
                if s["houses"] < 4:
                    raise IllegalMove("The bank doesn't have 4 houses to break the hotel.")
                s["houses"] -= 4
                s["hotels"] += 1
            else:
                s["houses"] += 1
            p["houses"] -= 1
            s["cash"][pid] += info["house"] // 2
            self.log(f"{self.name(pid)} menjual bangunan di {info['name']}", f"{self.name(pid)} sells a building on {info['name']}")
        s["turn_no"] += 1
        return [{"e": do, "who": pid, "sq": sq}]

    # ---- jail -----------------------------------------------------------------------------------------------------
    def _jail_pay(self, pid):
        s = self.s
        if s["jail"][pid] < 0 or s["phase"] != "roll":
            raise IllegalMove("You're not in jail.")
        if s["cash"][pid] < JAIL_FINE:
            raise IllegalMove("Not enough cash.")
        s["cash"][pid] -= JAIL_FINE
        if s["parking_rule"]:
            s["pot"] += JAIL_FINE
        s["jail"][pid] = -1
        s["turn_no"] += 1
        return [{"e": "jail_out", "who": pid, "how": "pay"}]

    def _jail_card(self, pid):
        s = self.s
        if s["jail"][pid] < 0 or s["phase"] != "roll" or not s["jailcards"][pid]:
            raise IllegalMove("You can't use a card now.")
        deck = s["jailcards"][pid].pop()
        idx = next(i for i, c in enumerate(CHANCE if deck == "chance" else CHEST) if c[2][0] == "jailcard")
        s[deck].append(idx)
        s["jail"][pid] = -1
        s["turn_no"] += 1
        return [{"e": "jail_out", "who": pid, "how": "card"}]

    # ---- trading -----------------------------------------------------------------------------------------------------
    def _trade_offer(self, pid, a):
        s = self.s
        to = str(a.get("to"))
        if to == pid or to not in self.active():
            raise IllegalMove("Pick another player.")
        give, get = a.get("give") or {}, a.get("get") or {}

        def check(side, who):
            props = [int(x) for x in side.get("props", [])]
            for sq in props:
                p = s["props"].get(str(sq))
                if not p or p["owner"] != who:
                    raise IllegalMove("You can only trade properties you own.")
                if any(s["props"][str(i)]["houses"] for i in GROUPS[SQUARES[sq]["group"]]):
                    raise IllegalMove("Sell the houses in that colour set before trading it.")
            cash = max(0, int(side.get("cash", 0)))
            if cash > s["cash"][who]:
                raise IllegalMove("Not enough cash for that trade.")
            cards = max(0, min(int(side.get("cards", 0)), len(s["jailcards"][who])))
            return {"props": props, "cash": cash, "cards": cards}

        offer = {"from": pid, "to": to, "give": check(give, pid), "get": check(get, to), "ends": None}
        if not (offer["give"]["props"] or offer["give"]["cash"] or offer["give"]["cards"] or offer["get"]["props"]
                or offer["get"]["cash"] or offer["get"]["cards"]):
            raise IllegalMove("The trade is empty.")
        offer["ends"] = 10**9  # set properly on the next tick
        s["trade"] = offer
        s["turn_no"] += 1
        return [{"e": "trade", "from": pid, "to": to}]

    def _trade_answer(self, pid, accept):
        s = self.s
        t = s["trade"]
        if not t or t["to"] != pid:
            raise IllegalMove("No trade for you.")
        s["trade"] = None
        s["turn_no"] += 1
        if not accept:
            return [{"e": "trade_no", "who": pid}]
        a, b = t["from"], t["to"]
        for side, src, dst in ((t["give"], a, b), (t["get"], b, a)):
            if s["cash"][src] < side["cash"]:  # noqa: B007
                return [{"e": "trade_fail"}]
        for side, src, dst in ((t["give"], a, b), (t["get"], b, a)):
            s["cash"][src] -= side["cash"]
            s["cash"][dst] += side["cash"]
            for sq in side["props"]:
                if s["props"][str(sq)]["owner"] == src:
                    s["props"][str(sq)]["owner"] = dst
            for _ in range(side["cards"]):
                if s["jailcards"][src]:
                    s["jailcards"][dst].append(s["jailcards"][src].pop())
        self.bump("trades", a)
        self.bump("trades", b)
        self.log(f"{self.name(a)} dan {self.name(b)} bertukar!", f"{self.name(a)} and {self.name(b)} made a trade!")
        return [{"e": "trade_ok", "from": a, "to": b}]

    # ---- turns ---------------------------------------------------------------------------------------------------------
    def _end_turn(self, pid):
        s = self.s
        s["card"] = None
        if s["again"] and s["jail"][pid] < 0 and pid not in s["bankrupt"]:
            s["again"] = False
            s["phase"] = "roll"
            s["turn_no"] += 1
            return [{"e": "again", "who": pid}]
        s["doubles"] = 0
        return self._next_player(pid)

    def _next_player(self, pid):
        s = self.s
        ids = self.ids()
        k = ids.index(pid)
        for step in range(1, len(ids) + 1):
            nxt = ids[(k + step) % len(ids)]
            if nxt not in s["bankrupt"]:
                s["phase"] = "roll"
                s["again"] = False
                s["doubles"] = 0
                s["card"] = None
                self.next_turn(nxt)
                return [{"e": "turn", "who": nxt}]
        return []

    def on_timeout(self, now):
        s = self.s
        if s["trade"]:
            return self._trade_answer(s["trade"]["to"], False)
        if s["phase"] == "debt":
            who = s["debt"]["who"]
            # Sell houses, then mortgage, until the debt can be paid.
            for _ in range(60):
                if s["cash"][who] >= s["debt"]["amount"]:
                    return self._pay_debt(who)
                sold = False
                for sq, p in s["props"].items():
                    if p["owner"] == who and p["houses"]:
                        try:
                            self._manage(who, "sell", int(sq))
                            sold = True
                            break
                        except IllegalMove:
                            continue
                if sold:
                    continue
                for sq, p in s["props"].items():
                    if p["owner"] == who and not p["mort"]:
                        try:
                            self._manage(who, "mortgage", int(sq))
                            sold = True
                            break
                        except IllegalMove:
                            continue
                if not sold:
                    break
            if s["cash"][who] >= s["debt"]["amount"]:
                return self._pay_debt(who)
            return self._bankrupt(who, s["debt"]["to"])
        pid = s["turn"]
        if s["phase"] in ("roll", "jail"):
            return self._roll(pid, now)
        if s["phase"] == "buy":
            return self._start_auction(s["pending"]["sq"], now)
        if s["phase"] == "manage":
            return self._end_turn(pid)
        return []

    def forfeit(self, pid, now):
        if pid in self.s["bankrupt"]:
            return []
        return self._bankrupt(pid, None)
