"""Wok & Roll career: each player's progress (money, chef level, skills, equipment, items, cosmetics).

The server owns the economy: prices, rewards and the resulting "kit" (the numbers the phone's kitchen
simulation uses) are computed here, so a duel uses everyone's real career gear. One JSON record per player
in bg_kv (`cook:<user id>`), written only when something changes (end of a day, a purchase, a duel)."""

from __future__ import annotations

import asyncio
import copy
import math
import random

from .pb import pb

# Level keys in play order (must match web/js/cook/levels.js; a test checks it).
LEVELS = ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "2-1", "2-2", "2-3", "2-4", "2-5", "2-6"]
MAX_DAY_COINS = 900        # cap on what one day can report (rb)
REPLAY_SHARE = 0.5         # replaying a day pays half
MAX_LEVEL = 30

# Equipment: bought with career money, upgraded level by level. `v` = the value at each level (0 = basic).
EQUIP = {
    "wajan": {"icon": "🍳", "id": "Panggangan & Wajan Pro", "en": "Pro Grill & Wok", "stat": "cook", "v": [1, .88, .78, .68], "cost": [0, 80, 180, 350],
              "did": "Masak lebih cepat", "den": "Cooks faster"},
    "kompor": {"icon": "🔥", "id": "Kompor Api Kecil", "en": "Low-flame Stove", "stat": "burn", "v": [1, 1.4, 1.8, 2.4], "cost": [0, 60, 150, 300],
               "did": "Lebih lama sebelum gosong", "den": "Food takes longer to burn"},
    "piring": {"icon": "🍽️", "id": "Piring Tambahan", "en": "Extra Plates", "stat": "plates", "v": [0, 1, 2], "cost": [0, 70, 170],
               "did": "Lebih banyak tempat piring di meja", "den": "More plating spots on the counter"},
    "radio": {"icon": "📻", "id": "Radio Dangdut", "en": "Dangdut Radio", "stat": "patience", "v": [1, 1.1, 1.2, 1.3], "cost": [0, 70, 160, 320],
              "did": "Pembeli lebih sabar", "den": "Customers are more patient"},
    "lampu": {"icon": "💡", "id": "Lampu Hias", "en": "Fairy Lights", "stat": "tip", "v": [1, 1.15, 1.3, 1.5], "cost": [0, 90, 200, 380],
              "did": "Tip lebih besar", "den": "Bigger tips"},
    "termos": {"icon": "🧃", "id": "Mesin Jus Cepat", "en": "Fast Juicer", "stat": "drink", "v": [1, .7, .5], "cost": [0, 60, 140],
               "did": "Minuman lebih cepat dibuat", "den": "Drinks are made faster"},
    "bangku": {"icon": "🪑", "id": "Meja Panjang", "en": "Longer Counter", "stat": "seats", "v": [0, 1], "cost": [0, 150],
               "did": "Satu pembeli lagi bisa dilayani sekaligus", "den": "Serve one more customer at a time"},
    "wajan2": {"icon": "🥘", "id": "Tungku Tambahan", "en": "Extra Burner", "stat": "wok2", "v": [0, 1], "cost": [0, 220],
               "did": "Satu tempat masak lagi (steak ke-4 / wajan ke-3)", "den": "One more cooking spot (4th steak / 3rd wok)"},
}

# Skills: one skill point per chef level above 1. `v` = value per rank (index 0 = not learned).
SKILLS = {
    "tangan": {"icon": "🤲", "id": "Tangan Kilat", "en": "Quick Hands", "stat": "quick", "v": [1, .93, .86, .8], "lvl": [0, 2, 4, 7],
               "did": "Semua masakan lebih cepat matang", "den": "Everything cooks faster"},
    "senyum": {"icon": "😊", "id": "Senyum Manis", "en": "Sweet Smile", "stat": "heart", "v": [1, 1.5, 2], "lvl": [0, 2, 5],
               "did": "Menyajikan memulihkan lebih banyak hati", "den": "Serving restores more hearts"},
    "siap": {"icon": "🍱", "id": "Siap Saji", "en": "Prep Ahead", "stat": "prep", "v": [0, 1, 2], "lvl": [0, 3, 6],
             "did": "Mulai hari dengan hidangan utama siap di piring", "den": "Start the day with main dishes already plated"},
    "combo": {"icon": "🔥", "id": "Raja Combo", "en": "Combo King", "stat": "combo", "v": [0, 1, 2, 3], "lvl": [0, 2, 5, 9],
              "did": "Jendela combo lebih lama & bonus lebih besar", "den": "Longer combo window, bigger bonus"},
    "kucing": {"icon": "🐟", "id": "Pawang Kucing", "en": "Cat Whisperer", "stat": "cat", "v": [0, 1, 2, 3], "lvl": [0, 3, 6, 10],
               "did": "Kucing lebih lambat; level 3 mengusir satu kucing otomatis", "den": "Cats are slower; rank 3 shoos one automatically"},
    "usil": {"icon": "😈", "id": "Biang Usil", "en": "Prankster", "stat": "card", "v": [5, 4, 3], "lvl": [0, 4, 8],
             "did": "Duel: kartu jahil lebih cepat didapat", "den": "Duel: earn prank cards sooner"},
    "tabah": {"icon": "🛡️", "id": "Tahan Banting", "en": "Unshakeable", "stat": "resist", "v": [1, .75, .5], "lvl": [0, 3, 7],
              "did": "Duel: kejahilan lawan lebih singkat", "den": "Duel: pranks against you are shorter"},
}

# Items: consumables, used during a day or a duel (at most MAX_ITEM_USES per day).
ITEMS = {
    "kopi": {"icon": "☕", "id": "Kopi Sachet", "en": "Sachet Coffee", "cost": 25, "did": "Masak 50% lebih cepat 10 detik", "den": "Cook 50% faster for 10 s"},
    "bel": {"icon": "🔔", "id": "Lonceng Ramah", "en": "Friendly Bell", "cost": 30, "did": "Semua pembeli +2 hati", "den": "Every customer +2 hearts"},
    "sambal": {"icon": "🌶️", "id": "Sambal Rahasia Nenek", "en": "Grandma's Secret Sambal", "cost": 40,
               "did": "3 pesanan berikutnya tip ×2", "den": "Next 3 orders tip ×2"},
    "ikan": {"icon": "🐟", "id": "Ikan Asin", "en": "Salted Fish", "cost": 20, "did": "Usir semua kucing, aman 20 detik", "den": "Shoo all cats, safe for 20 s"},
    "senter": {"icon": "🔦", "id": "Senter", "en": "Torch", "cost": 20, "did": "Akhiri mati lampu, aman 20 detik", "den": "End a power cut, safe for 20 s"},
    "payung": {"icon": "☂️", "id": "Payung", "en": "Umbrella", "cost": 20, "did": "Akhiri hujan, aman 20 detik", "den": "End the rain, safe for 20 s"},
}
MAX_ITEMS = 9
MAX_ITEM_USES = 3

# Cosmetics unlocked by total stars.
HATS = [("toque", 0), ("bandana", 6), ("cap", 12), ("peci", 18), ("crown", 33)]
CARTS = [("hijau", 0), ("biru", 4), ("merah", 9), ("kuning", 15), ("ungu", 24)]
MODELS = ["q-blonde", "s-suitw", "n-dress", "d-punk", "k-casual", "g-purple", "j-suit", "b-beach"]   # web/js/cook/levels.js CHEF_MODELS

DUEL_REWARD = {1: (40, 30), 2: (20, 18), 3: (15, 15), 4: (12, 12)}  # rank -> (money rb, xp)

_locks: dict[str, asyncio.Lock] = {}


def lock(uid: str) -> asyncio.Lock:
    return _locks.setdefault(uid, asyncio.Lock())


def new_save(name: str = "") -> dict:
    return {"v": 1, "money": 0, "xp": 0, "stars": {}, "best": {}, "equip": {}, "skills": {}, "items": {"kopi": 1, "bel": 1},
            "chef": {"model": MODELS[0], "name": name[:24], "hat": "toque", "cart": "hijau"}, "seen": [],
            "stats": {"days": 0, "served": 0, "duels": 0, "wins": 0}}


def level_of(xp: int) -> int:
    """Chef level: level n needs 50·n·(n−1)/2 XP (50, 150, 300, 500, …)."""
    n = int((1 + math.sqrt(1 + 8 * max(0, xp) / 50)) / 2)
    return max(1, min(MAX_LEVEL, n))


def xp_for(level: int) -> int:
    return 50 * level * (level - 1) // 2


def total_stars(save: dict) -> int:
    return sum(int(v) for v in save.get("stars", {}).values())


def skill_points(save: dict) -> int:
    spent = sum(int(r) for r in save.get("skills", {}).values())
    return level_of(save.get("xp", 0)) - 1 - spent


def unlocked(save: dict, key: str) -> bool:
    if key not in LEVELS:
        return False
    i = LEVELS.index(key)
    return i == 0 or int(save.get("stars", {}).get(LEVELS[i - 1], 0)) >= 1


def kit(save: dict | None, equal: bool = False) -> dict:
    """The numbers the kitchen simulation uses. `equal` = a fair duel: everyone gets the basic kit."""
    s = save or new_save()
    eq = {} if equal else s.get("equip", {})
    sk = {} if equal else s.get("skills", {})

    def e(k):
        d = EQUIP[k]
        return d["v"][min(int(eq.get(k, 0)), len(d["v"]) - 1)]

    def k_(k):
        d = SKILLS[k]
        return d["v"][min(int(sk.get(k, 0)), len(d["v"]) - 1)]

    chef = s.get("chef", {})
    return {
        "cook": e("wajan"), "burn": e("kompor"), "plates": int(e("piring")), "patience": e("radio"), "tip": e("lampu"),
        "drink": e("termos"), "seats": int(e("bangku")), "wok2": bool(e("wajan2")),
        "quick": k_("tangan"), "heart": k_("senyum"), "prep": int(k_("siap")), "combo": int(k_("combo")),
        "cat": int(k_("kucing")), "card": int(k_("usil")), "resist": k_("tabah"),
        "level": level_of(s.get("xp", 0)), "equal": equal,
        "model": chef.get("model", MODELS[0]), "hat": chef.get("hat", "toque"), "cart": chef.get("cart", "hijau"),
        "name": chef.get("name", ""),
        "items": {} if equal else {k: int(v) for k, v in s.get("items", {}).items() if k in ITEMS and int(v) > 0},
    }


def catalog() -> dict:
    return {"equip": EQUIP, "skills": SKILLS, "items": ITEMS, "hats": HATS, "carts": CARTS, "models": MODELS,
            "levels": LEVELS, "max_item_uses": MAX_ITEM_USES, "xp_levels": [xp_for(n) for n in range(1, MAX_LEVEL + 2)]}


# ---- pure rules (tested) ---------------------------------------------------------------------------------
class CookError(ValueError):
    pass


def use_items(save: dict, used: dict) -> dict:
    """Take used items out of the inventory (only ones the player has, at most MAX_ITEM_USES)."""
    out, left = {}, MAX_ITEM_USES
    for k, n in (used or {}).items():
        if k not in ITEMS or left <= 0:
            continue
        have = int(save["items"].get(k, 0))
        take = max(0, min(int(n or 0), have, left))
        if take:
            save["items"][k] = have - take
            out[k] = take
            left -= take
    return out


def apply_day(save: dict, key: str, coins: int, stars: int, served: int, used: dict | None = None,
              rng: random.Random | None = None) -> dict:
    """A finished career day. Returns what was earned (money, xp, items, level up)."""
    if not unlocked(save, key):
        raise CookError("Level belum terbuka.")
    rng = rng or random.Random()
    coins = max(0, min(int(coins), MAX_DAY_COINS))
    stars = max(0, min(int(stars), 3))
    served = max(0, min(int(served), 40))
    before_lvl = level_of(save["xp"])
    prev_stars = int(save["stars"].get(key, 0))
    first = key not in save["best"]
    money = coins if first else int(coins * REPLAY_SHARE)
    xp = served * 2 + max(0, stars - prev_stars) * 15 + (10 if first and stars else 0)
    drops: dict[str, int] = {}
    if stars == 3 and prev_stars < 3:
        for k in rng.sample(sorted(ITEMS), 2):
            drops[k] = drops.get(k, 0) + 1
    if stars and key.endswith("-6") and prev_stars == 0:  # chapter finished
        drops["sambal"] = drops.get("sambal", 0) + 2
    for k, n in drops.items():
        save["items"][k] = min(MAX_ITEMS, int(save["items"].get(k, 0)) + n)
    used_now = use_items(save, used or {})
    save["money"] += money
    save["xp"] += xp
    save["stars"][key] = max(prev_stars, stars)
    save["best"][key] = max(int(save["best"].get(key, 0)), coins)
    save["stats"]["days"] += 1
    save["stats"]["served"] += served
    return {"money": money, "xp": xp, "drops": drops, "used": used_now, "first": first,
            "level_up": level_of(save["xp"]) > before_lvl, "level": level_of(save["xp"])}


def _get(table: dict, key: str) -> dict:
    if key not in table:
        raise CookError("?")
    return table[key]


def buy(save: dict, kind: str, key: str) -> dict:
    if kind == "equip":
        d = _get(EQUIP, key)
        cur = int(save["equip"].get(key, 0))
        if cur + 1 >= len(d["cost"]):
            raise CookError("Sudah maksimal.")
        cost = d["cost"][cur + 1]
        if save["money"] < cost:
            raise CookError("Uangnya kurang.")
        save["money"] -= cost
        save["equip"][key] = cur + 1
        return {"cost": cost, "level": cur + 1}
    if kind == "skill":
        d = _get(SKILLS, key)
        cur = int(save["skills"].get(key, 0))
        if cur + 1 >= len(d["v"]):
            raise CookError("Sudah maksimal.")
        if level_of(save["xp"]) < d["lvl"][cur + 1]:
            raise CookError(f"Butuh chef level {d['lvl'][cur + 1]}.")
        if skill_points(save) <= 0:
            raise CookError("Poin skill habis.")
        save["skills"][key] = cur + 1
        return {"rank": cur + 1}
    if kind == "item":
        d = _get(ITEMS, key)
        have = int(save["items"].get(key, 0))
        if have >= MAX_ITEMS:
            raise CookError("Tas penuh.")
        if save["money"] < d["cost"]:
            raise CookError("Uangnya kurang.")
        save["money"] -= d["cost"]
        save["items"][key] = have + 1
        return {"cost": d["cost"], "have": have + 1}
    raise CookError("?")


def set_chef(save: dict, data: dict) -> None:
    chef = save["chef"]
    stars = total_stars(save)
    if data.get("model") in MODELS:
        chef["model"] = data["model"]
    if isinstance(data.get("name"), str):
        chef["name"] = data["name"].strip()[:24]
    if any(h == data.get("hat") and stars >= need for h, need in HATS):
        chef["hat"] = data["hat"]
    if any(c == data.get("cart") and stars >= need for c, need in CARTS):
        chef["cart"] = data["cart"]
    for k in data.get("seen", []) if isinstance(data.get("seen"), list) else []:
        if isinstance(k, str) and len(k) < 20 and k not in save["seen"]:
            save["seen"].append(k)
    save["seen"] = save["seen"][-60:]


def apply_duel(save: dict, rank: int, used: dict | None, equal: bool) -> dict:
    money, xp = DUEL_REWARD.get(rank, DUEL_REWARD[4])
    used_now = {} if equal else use_items(save, used or {})
    save["money"] += money
    save["xp"] += xp
    save["stats"]["duels"] += 1
    if rank == 1:
        save["stats"]["wins"] += 1
    return {"money": money, "xp": xp, "used": used_now}


def migrate(save: dict | None, name: str = "") -> dict:
    base = new_save(name)
    if not isinstance(save, dict):
        return base
    out = copy.deepcopy(base)
    for k, v in save.items():
        if k in out and isinstance(v, type(out[k])):
            out[k] = v if not isinstance(v, dict) else {**out[k], **v}
    if out["chef"].get("model") not in MODELS:   # characters from an older version of the game
        out["chef"]["model"] = MODELS[0]
    return out


# ---- storage ----------------------------------------------------------------------------------------------
async def load(uid: str, name: str = "") -> dict:
    return migrate(await pb.kv_get(f"cook:{uid}"), name)


async def store(uid: str, save: dict) -> None:
    await pb.kv_set(f"cook:{uid}", save)


def summary(save: dict) -> dict:
    """What friends see on the career map."""
    done = [k for k in LEVELS if int(save["stars"].get(k, 0)) >= 1]
    return {"level": level_of(save["xp"]), "stars": total_stars(save), "days": len(done),
            "chapter": int(done[-1].split("-")[0]) if done else 1, "hat": save["chef"].get("hat"),
            "model": save["chef"].get("model"), "wins": save["stats"].get("wins", 0)}
