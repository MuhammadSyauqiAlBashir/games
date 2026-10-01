"""New speed and photo games: play each one to the end with simulated players.
Run: python -m pytest -q tests"""

import asyncio
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bg import ai, lexicon  # noqa: E402
from bg.games import GAMES, IllegalMove  # noqa: E402
from bg.games.speed import dobble_deck, type_norm  # noqa: E402
from bg.games.survei import bank, matches  # noqa: E402


def players(n):
    return [{"id": f"p{i}", "name": f"P{i}", "team": i, "avatar": "🐱", "color": "#888"} for i in range(n)]


def make(key, n, opts=None, seed=1):
    cls = GAMES[key]
    rng = random.Random(seed)
    g = cls(cls.setup(players(n), opts or {}, rng, 0.0), rng)
    return g


def run(g, step, until=4000.0, dt=0.25):
    t = 0.0
    while not g.over and t < until:
        g.tick(t)
        step(g, t)
        t += dt
    assert g.over, f"{type(g).__name__} did not finish (phase {g.s.get('phase')})"
    ranks = sorted(r["rank"] for r in g.results())
    assert ranks[0] == 1 and len(ranks) == len(g.ids())
    return t


@pytest.mark.parametrize("lang", ["id", "en"])
def test_bomkata(lang):
    g = make("bomkata", 3, {"lang": lang, "lives": 2, "fuse": "cepat"})
    pool = sorted(lexicon.roots_id()) if lang == "id" else sorted(w for w, z in __import__("bg.words", fromlist=["x"]).words().items() if z > 3.5)
    rng = random.Random(5)
    seen_bad = []
    by_syl = {}

    def step(g, t):
        s = g.s
        if s["phase"] != "play" or rng.random() < 0.6:
            return
        if rng.random() < 0.15:
            ev = g.act(s["turn"], {"do": "word", "w": "zzzq" + s["syl"]}, t)
            seen_bad.append(ev[0]["why"])
            return
        if s["syl"] not in by_syl:
            by_syl[s["syl"]] = [w for w in pool if s["syl"] in w and len(w) > len(s["syl"])]
        cands = [w for w in by_syl[s["syl"]] if w not in s["used"]]
        if cands:
            g.act(s["turn"], {"do": "word", "w": rng.choice(cands)}, t)

    run(g, step)
    assert sum(g.s["scores"].values()) > 0 and "unknown" in seen_bad or "syl" in seen_bad
    assert sum(1 for p in g.ids() if g.s["lives"][p] > 0) <= 1


def test_bomkata_rules():
    g = make("bomkata", 2, {"lang": "id"})
    g.tick(5)
    s = g.s
    s["syl"] = "ma"
    other = [p for p in g.ids() if p != s["turn"]][0]
    with pytest.raises(IllegalMove):
        g.act(other, {"do": "word", "w": "makan"}, 5)
    holder = s["turn"]
    assert g.act(holder, {"do": "word", "w": "kuda"}, 5)[0]["why"] == "syl"
    assert g.act(holder, {"do": "word", "w": "makanan"}, 5)[0]["e"] == "good"
    assert s["turn"] == other
    s["syl"] = "an"
    assert g.act(other, {"do": "word", "w": "makanan"}, 6)[0]["why"] == "used"


def test_refleks():
    g = make("refleks", 3, {"rounds": 5})
    rng = random.Random(2)

    def step(g, t):
        s = g.s
        if s["phase"] == "run" and t > s["t0"] + s["rounds"][s["r"]]["go"]:
            for p in g.ids():
                if p not in s["res"] and rng.random() < 0.5:
                    g.act(p, {"do": "tap" if rng.random() < 0.85 else "false", "r": s["r"] + 1, "ms": rng.randint(150, 600)}, t)

    run(g, step)
    assert max(g.s["scores"].values()) > 0
    kinds = {r["k"] for r in g.s["rounds"]}
    assert kinds <= {"green", "target", "stroop"}
    st = [r for r in g.s["rounds"] if r["k"] == "stroop"]
    for r in st:
        assert r["seq"][-1][1] == r["seq"][-1][2] and all(a != b for _, a, b in r["seq"][:-1])


def test_ketik():
    g = make("ketik", 3, {"rounds": 3, "lang": "id"})
    rng = random.Random(3)

    def step(g, t):
        s = g.s
        if s["phase"] != "play":
            return
        rd = s["rounds"][s["r"]]
        for p in g.ids():
            if p in s["done"] or rng.random() < 0.9:
                continue
            g.act(p, {"do": "p", "n": rng.randint(0, len(rd["target"]))}, t)
            if rng.random() < 0.4:
                with pytest.raises(IllegalMove):
                    g.act(p, {"do": "done", "text": rd["target"] + " x"}, t)
                g.act(p, {"do": "done", "text": rd["text"].upper(), "errs": 2}, t)

    run(g, step)
    assert all(v > 0 for v in g.s["wpm"].values())
    assert type_norm("Halo, Dunia!  Apa kabar?") == "halo dunia apa kabar"


def test_kembar():
    g = make("kembar", 3, {"target": 5})
    deck = dobble_deck()
    rng = random.Random(4)

    def step(g, t):
        s = g.s
        if s["phase"] != "play":
            return
        p = rng.choice(g.ids())
        common = (set(deck[s["cards"][p]]) & set(deck[s["center"]])).pop()
        if rng.random() < 0.2:
            wrong = next(x for x in deck[s["cards"][p]] if x != common)
            try:
                g.act(p, {"do": "tap", "sym": wrong, "c": s["c"]}, t)
            except IllegalMove:
                pass
            return
        try:
            g.act(p, {"do": "tap", "sym": common, "c": s["c"]}, t)
        except IllegalMove:
            pass

    run(g, step)
    assert max(g.s["scores"].values()) == 5
    lay = g.view("p0")["mine"]
    assert len(lay) == 8 and all(0 <= sym < 57 for sym, *_ in lay)


def test_survei_matching():
    ans = {"a": "hp", "pts": 22, "alias": ["handphone", "ponsel"]}
    assert matches("id", "HP", ans) and matches("id", "hand phone", ans) and matches("id", "ponselnya", ans)
    assert not matches("id", "dompet", ans)
    ans = {"a": "opor ayam", "pts": 24, "alias": ["opor"]}
    assert matches("id", "opor", ans) and matches("id", "opor ayam kampung", ans)
    assert matches("en", "keys", {"a": "key", "pts": 30, "alias": []})
    for lang in ("id", "en"):
        for b in bank(lang):
            assert sum(a["pts"] for a in b["answers"]) == 100 and len(b["answers"]) >= 5


def test_survei_play():
    boards = bank("id")[:3]
    g = make("survei", 3, {"rounds": 3, "seconds": 45, "__content": {"boards": boards}})
    rng = random.Random(6)

    def step(g, t):
        s = g.s
        if s["phase"] != "play":
            return
        p = rng.choice(g.ids())
        ans = rng.choice(s["boards"][s["r"]]["answers"])
        g.act(p, {"do": "guess", "text": ans["a"] if rng.random() < 0.7 else "xyz"}, t)

    run(g, step)
    assert max(g.s["scores"].values()) > 0


def test_fotohunt():
    g = make("fotohunt", 3, {"rounds": 3, "seconds": 45})
    rng = random.Random(7)

    def step(g, t):
        s = g.s
        if s["phase"] != "play":
            return
        for p in g.ids():
            if g.photo_ok(p, s["r"] + 1) is None and rng.random() < 0.2:
                g.server_input(p, {"do": "photo", "r": s["r"] + 1}, t)
                assert g.photo_ok(p, s["r"] + 1)  # a photo is being checked
                g.server_input(p, {"do": "checked", "r": s["r"] + 1, "ok": rng.random() < 0.6, "comment": "ok", "what": "x"}, t)

    run(g, step)
    assert max(g.s["scores"].values()) > 0
    with pytest.raises(IllegalMove):
        g.act("p0", {"do": "anything"}, 0)


def test_ekspresi(monkeypatch):
    g = make("ekspresi", 3, {"rounds": 2, "seconds": 20})
    t = 0.0
    while g.s["phase"] != "play":
        g.tick(t)
        t += 0.5
    for p in g.ids():
        g.server_input(p, {"do": "photo", "r": 1}, t)
    need = g.s["ai_need"]
    assert g.s["phase"] == "judging" and need["ids"] == g.ids()

    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), "orange").save(buf, "JPEG")

    class Room:
        photos = {f"1:{p}": buf.getvalue() for p in g.ids()}

    async def fake(parts, **k):
        return {"ranking": [{"label": "B", "score": 90, "comment": "wow"}, {"label": "A", "score": 50, "comment": "ok"},
                            {"label": "C", "score": 10, "comment": "hmm"}]}

    monkeypatch.setattr(ai, "generate", fake)
    res = asyncio.run(GAMES["ekspresi"].fulfil_room(need, {}, Room()))
    g.provide(need, res, t)
    v = g.view("p0")
    assert v["result"][0]["id"] == "p1" and v["result"][0]["pts"] == 300
    # round 2: nobody sends a photo, nobody scores
    while g.s["phase"] != "play":
        g.tick(t)
        t += 0.5
    g.tick(t + 100)
    assert g.s["phase"] == "result" and all(r["pts"] == 0 for r in g.s["result"])
    while not g.over:
        t += 1
        g.tick(t)
    assert g.results()[0]["id"] == "p1"


def test_ekspresi_ties_share_points():
    g = make("ekspresi", 3, {"rounds": 1})
    t = 0.0
    while g.s["phase"] != "play":
        g.tick(t)
        t += 0.5
    for p in g.ids():
        g.server_input(p, {"do": "photo", "r": 1}, t)
    res = {"ranking": [{"id": "p0", "score": 75, "comment": ""}, {"id": "p1", "score": 75, "comment": ""}, {"id": "p2", "score": 20, "comment": ""}]}
    g.provide(g.s["ai_need"], res, t)
    pts = {r["id"]: r["pts"] for r in g.s["result"]}
    assert pts["p0"] == pts["p1"] == 300 and pts["p2"] == 100
