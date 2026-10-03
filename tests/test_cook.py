"""Wok & Roll: career economy rules and the duel engine.
Run: python -m pytest -q tests"""

import asyncio
import os
import random
import re
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bg import cook  # noqa: E402
from bg.games import GAMES, IllegalMove  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")


def test_level_keys_match_frontend():
    src = open(os.path.join(ROOT, "web", "js", "cook", "levels.js")).read()
    keys = re.findall(r'key: "(\d-\d)"', src)
    assert keys == cook.LEVELS


def test_chef_levels():
    assert cook.level_of(0) == 1 and cook.level_of(49) == 1 and cook.level_of(50) == 2
    assert cook.level_of(150) == 3 and cook.level_of(10 ** 9) == cook.MAX_LEVEL
    for n in range(1, 12):
        assert cook.level_of(cook.xp_for(n)) == n


def test_day_unlocks_and_rewards():
    s = cook.new_save("Bella")
    with pytest.raises(cook.CookError):
        cook.apply_day(s, "1-2", 100, 3, 6)
    r = cook.apply_day(s, "1-1", 120, 3, 6, rng=random.Random(1))
    assert r["money"] == 120 and r["first"] and sum(r["drops"].values()) == 2
    assert s["stars"]["1-1"] == 3 and cook.unlocked(s, "1-2")
    r2 = cook.apply_day(s, "1-1", 120, 3, 6)
    assert r2["money"] == 60 and not r2["drops"]           # replay pays half, no second drop
    r3 = cook.apply_day(s, "1-2", 10 ** 5, 9, 999)           # silly numbers are capped
    assert r3["money"] == cook.MAX_DAY_COINS and s["stars"]["1-2"] == 3


def test_buying_and_kit():
    s = cook.new_save()
    s["money"] = 1000
    s["xp"] = cook.xp_for(4)
    base = cook.kit(s)
    cook.buy(s, "equip", "piring")
    cook.buy(s, "equip", "piring")
    cook.buy(s, "skill", "tangan")
    cook.buy(s, "item", "kopi")
    k = cook.kit(s)
    assert k["plates"] == 2 > base["plates"] and k["quick"] < base["quick"] and k["items"]["kopi"] == 2
    assert cook.kit(s, equal=True)["plates"] == 0 and not cook.kit(s, equal=True)["items"]
    with pytest.raises(cook.CookError):
        cook.buy(s, "skill", "kucing")                       # rank 1 needs chef level 3: fine
        cook.buy(s, "skill", "kucing")                       # rank 2 needs chef level 6: refused
    s["money"] = 0
    with pytest.raises(cook.CookError):
        cook.buy(s, "equip", "lampu")


def test_skill_points_limit():
    s = cook.new_save()
    s["xp"] = cook.xp_for(3)           # level 3 = 2 points
    cook.buy(s, "skill", "tangan")
    cook.buy(s, "skill", "senyum")
    with pytest.raises(cook.CookError):
        cook.buy(s, "skill", "combo")


def test_items_used_only_if_owned():
    s = cook.new_save()
    s["items"] = {"kopi": 1, "bel": 5}
    used = cook.use_items(s, {"kopi": 4, "bel": 1, "nope": 3})
    assert used == {"kopi": 1, "bel": 1} and s["items"] == {"kopi": 0, "bel": 4}


def test_chef_cosmetics_need_stars():
    s = cook.new_save()
    cook.set_chef(s, {"hat": "crown", "model": "j-suit", "name": "  Chef Bells  ", "cart": "ungu"})
    assert s["chef"]["hat"] == "toque" and s["chef"]["model"] == "j-suit" and s["chef"]["name"] == "Chef Bells"
    s["stars"] = {k: 3 for k in cook.LEVELS}
    cook.set_chef(s, {"hat": "crown", "cart": "ungu"})
    assert s["chef"]["hat"] == "crown" and s["chef"]["cart"] == "ungu"


def players(n):
    return [{"id": f"p{i}", "name": f"P{i}", "team": i, "avatar": "🐱", "color": "#888"} for i in range(n)]


def test_duel_runs_with_kits_pranks_and_items():
    cls = GAMES["cookduel"]
    kits = {"p0": cook.kit({**cook.new_save(), "items": {"kopi": 1}}), "p1": cook.kit(None)}
    rng = random.Random(3)
    g = cls(cls.setup(players(2), {"seconds": 90, "__content": {"kits": kits}}, rng, 0.0), rng)
    t = 0.0
    while g.s["phase"] != "play":
        g.tick(t)
        t += 0.25
    v = g.view("p0")
    assert v["dur"] == 90 and v["kits"]["p0"]["items"]["kopi"] == 1
    ev = g.act("p0", {"do": "item", "k": "kopi"}, t)
    assert ev[0]["e"] == "item"
    with pytest.raises(IllegalMove):
        g.act("p0", {"do": "item", "k": "kopi"}, t)              # only had one
    ev = g.act("p1", {"do": "prank", "kind": "blackout", "target": "p0"}, t)
    assert ev[0]["target"] == "p0" and "to" not in ev[0]           # public event
    with pytest.raises(IllegalMove):
        g.act("p1", {"do": "prank", "kind": "cat", "target": "p0"}, t + 1)
    score = {"p0": 0, "p1": 0}
    while not g.over and t < 400:
        g.tick(t)
        if g.s["phase"] == "play":
            for p in score:
                score[p] += 3 if p == "p0" else 2
                g.act(p, {"do": "score", "v": score[p]}, t)
        t += 0.25
    assert g.over and g.results()[0]["id"] == "p0"


def test_duel_after_finish_rewards(monkeypatch):
    saves = {"p0": cook.new_save(), "p1": cook.new_save()}
    saves["p0"]["items"] = {"kopi": 2}

    async def load(uid, name=""):
        return saves[uid]

    async def store(uid, save):
        saves[uid] = save

    monkeypatch.setattr(cook, "load", load)
    monkeypatch.setattr(cook, "store", store)
    cls = GAMES["cookduel"]
    g = cls(cls.setup(players(2), {}, random.Random(1), 0.0), random.Random(1))
    g.s["used"]["p0"] = {"kopi": 1}
    g.finish([["p0"], ["p1"]], {"p0": 50, "p1": 20})
    out = asyncio.run(cls.after_finish(g, None))
    assert out["cook"]["p0"]["money"] == cook.DUEL_REWARD[1][0]
    assert saves["p0"]["items"]["kopi"] == 1 and saves["p0"]["stats"]["wins"] == 1 and saves["p1"]["stats"]["duels"] == 1


def test_old_character_models_fall_back():
    old = cook.new_save()
    old["chef"]["model"] = "female-e"   # Kenney mini characters before the realistic people
    assert cook.migrate(old)["chef"]["model"] == cook.MODELS[0]


def test_chef_models_match_frontend():
    src = open(os.path.join(ROOT, "web", "js", "cook", "levels.js")).read()
    js = re.search(r"CHEF_MODELS = \[([^\]]*)\]", src).group(1)
    assert re.findall(r'"([^"]+)"', js) == cook.MODELS
