"""Drawing games: categorised words that don't repeat, and the AI judge that retries before giving up.
Run: python -m pytest -q tests"""

import asyncio
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bg import ai, content, util  # noqa: E402
from bg.games import drawing  # noqa: E402


def no_ai(monkeypatch, memory):
    async def gen(*a, **k):
        raise ai.AIUnavailable("test")

    async def kv_get(key, default=None):
        return memory.get(key, default)

    async def kv_set(key, value):
        memory[key] = value

    monkeypatch.setattr(ai, "generate", gen)
    monkeypatch.setattr(content.pb, "kv_get", kv_get)
    monkeypatch.setattr(content.pb, "kv_set", kv_set)


def test_words_have_categories_and_neighbours_differ(monkeypatch):
    no_ai(monkeypatch, {})
    words = asyncio.run(content.draw_words("id", 2, 24, "", random.Random(1)))
    assert len(words) == 24 and len({util.norm(w["w"]) for w in words}) == 24
    assert all(w["c"] in content.DRAW_CATS for w in words)
    for i in range(0, 24, 3):  # a drawer's three choices come from three categories
        assert len({w["c"] for w in words[i:i + 3]}) == 3


def test_one_category_and_expert(monkeypatch):
    no_ai(monkeypatch, {})
    words = asyncio.run(content.draw_words("en", 1, 10, "", random.Random(2), "hewan"))
    assert len(words) == 10 and all(w["c"] == "hewan" for w in words)
    words = asyncio.run(content.draw_words("id", 4, 12, "", random.Random(3)))
    assert sum(w["c"] in content.EXPERT_CATS for w in words) >= 2


def test_recent_words_are_not_repeated(monkeypatch):
    mem = {}
    no_ai(monkeypatch, mem)
    seen = []
    for g in range(6):  # six games in a row, 15 words each: no repeats while unused words are left
        words = asyncio.run(content.draw_words("id", 2, 15, "", random.Random(g)))
        asyncio.run(content.remember_draw_words("id", [w["w"] for w in words]))
        seen += [util.norm(w["w"]) for w in words]
    assert len(seen) == len(set(seen))
    assert len(mem["draw_recent:id"]) == 90


def test_race_gemini_busy_cloudflare_answers():
    from bg import vision
    calls = {"g": 0, "c": 0}

    async def gem():
        calls["g"] += 1
        await asyncio.sleep(0.3)
        raise ai.AIUnavailable("503")

    async def cf():
        calls["c"] += 1
        return {"ranking": ["cf"]}

    out = asyncio.run(vision.race(gem, cf, budget=5, head_start=0.5))
    assert out == {"ranking": ["cf"]} and calls["g"] >= 1 and calls["c"] == 1


def test_race_gemini_fast_wins_and_backup_unused():
    from bg import vision
    used = []

    async def gem():
        return {"ok": 1}

    async def cf():
        used.append(1)
        return {"ok": 2}

    assert asyncio.run(vision.race(gem, cf, budget=5, head_start=1)) == {"ok": 1} and not used


def test_race_everything_busy_gives_none():
    from bg import vision

    async def busy():
        raise ai.AIUnavailable("429")

    assert asyncio.run(vision.race(busy, busy, budget=4, head_start=0.2)) is None


def test_collage_labels():
    import io
    from PIL import Image
    from bg import vision
    px = io.BytesIO()
    Image.new("RGB", (50, 80), "red").save(px, "PNG")
    grid = Image.open(io.BytesIO(vision.collage([("A", px.getvalue()), ("B", px.getvalue()), ("C", px.getvalue())])))
    assert grid.size == (768, 768)


def test_drawjudge_flow_with_busy_judge():
    players = [{"id": f"p{i}", "name": f"P{i}", "team": i, "avatar": "🐱", "color": "#888"} for i in range(3)]
    opts = {"rounds": 2, "seconds": 30, "lang": "en", "__content": {"words": [{"w": "cat", "c": "hewan"}, {"w": "kite", "c": "olahraga"}]}}
    g = drawing.DrawJudge(drawing.DrawJudge.setup(players, opts, random.Random(1), 0), random.Random(1))
    g.tick(5)
    v = g.view("p0")
    assert v["word"] == "cat" and v["cat"]["key"] == "hewan"
    g.stroke("p0", {"k": "b", "c": "#000", "w": 4, "p": [[1, 1], [50, 50]]}, 6)
    g.tick(100)
    assert g.s["phase"] == "judging" and g.s["ai_need"]["cat"] == "hewan"
    g.provide(g.s["ai_need"], None, 130)
    res = g.view("p0")["result"]
    assert res[0]["id"] == "p0" and "busy" in res[0]["comment"]


def test_drawguess_choices_show_category():
    players = [{"id": f"p{i}", "name": f"P{i}", "team": i, "avatar": "🐱", "color": "#888"} for i in range(2)]
    words = [{"w": w, "c": c} for w, c in [("cat", "hewan"), ("kite", "olahraga"), ("bus", "kendaraan")] * 4]
    g = drawing.DrawGuess(drawing.DrawGuess.setup(players, {"rounds": 1, "__content": {"words": words}}, random.Random(1), 0), random.Random(1))
    g.tick(2)
    drawer = g.s["drawer"]
    ch = g.view(drawer)["choices"]
    assert [c["w"] for c in ch] == ["cat", "kite", "bus"] and ch[0]["cat"]["key"] == "hewan"
    g.act(drawer, {"do": "pick", "i": 1}, 3)
    other = next(p["id"] for p in players if p["id"] != drawer)
    assert g.view(other)["cat"]["key"] == "olahraga" and g.view(other)["word"] is None
