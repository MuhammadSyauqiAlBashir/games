"""Play many random games of every engine to catch crashes, stuck states and bad endings.
Run: python -m pytest -q tests"""

import os
import random
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bg.games import GAMES, IllegalMove  # noqa: E402
from bg.games.cards import best_hand  # noqa: E402


def players(n):
    return [{"id": f"p{i}", "name": f"P{i}", "team": i, "avatar": "🐱", "color": "#888"} for i in range(n)]


def random_action(key, g, pid, rng):
    v = g.view(pid)
    if key == "sos":
        empt = [i for i, x in enumerate(v["grid"]) if not x]
        return {"i": rng.choice(empt), "l": rng.choice("SO")}
    if key == "tictactoe":
        return {"i": rng.choice([i for i, x in enumerate(v["grid"]) if not x])}
    if key == "connect4":
        return {"col": rng.randrange(v["w"])}
    if key == "checkers":
        return {"path": rng.choice(v["moves"])["path"]}
    if key == "ludo":
        return {"do": "roll"} if v["phase"] == "roll" else {"do": "move", "piece": rng.choice(v["moves"])}
    if key == "ulartangga":
        return {"do": "roll"}
    if key == "congklak":
        side = v["side"][pid]
        holes = [i for i in (range(7) if side == 0 else range(8, 15)) if v["board"][i]]
        return {"hole": rng.choice(holes)}
    if key == "sequence":
        if v["dead"] and rng.random() < 0.3 and not v["swapped"]:
            return {"dead": v["dead"][0]}
        i = rng.randrange(len(v["hand"]))
        t = g.targets(pid, v["hand"][i])
        return {"card": i, "cell": rng.choice(t) if t else -1}
    if key == "uno":
        r = rng.random()
        if r < 0.05:
            return {"do": "uno"}
        if r < 0.1:
            return {"do": "catch"}
        if v["phase"] == "respond4":
            return {"do": rng.choice(["accept", "challenge"])}
        if v["phase"] == "swap":
            return {"do": "swap", "target": rng.choice([p for p in g.ids() if p != pid])}
        if v["phase"] == "drawn" and rng.random() < 0.3:
            return {"do": "keep"}
        if v["can"]:
            i = rng.choice(v["can"])
            return {"do": "play", "i": i, "color": rng.choice("RGBY")}
        return {"do": "draw"}
    if key == "gaple":
        if v["can"]:
            i = rng.choice(list(v["can"]))
            return {"do": "play", "i": int(i), "side": rng.choice(v["can"][i])}
        return {"do": "draw"} if v["bone"] else {"do": "pass"}
    if key == "poker":
        lg = v["legal"]
        opts = []
        if lg.get("fold"):
            opts.append({"do": "fold"})
        if lg.get("check"):
            opts.append({"do": "check"})
        if lg.get("call"):
            opts.append({"do": "call"})
        if lg.get("can_raise"):
            opts.append({"do": "raise", "to": rng.randint(lg["min_raise"], lg["max_raise"])})
            opts.append({"do": "allin"})
        return rng.choice(opts)
    if key == "monopoly":
        ph = v["phase"]
        if v["trade"] and v["trade"]["to"] == pid:
            return {"do": rng.choice(["trade_accept", "trade_reject"])}
        if ph == "debt":
            mine = [int(sq) for sq, p in v["props"].items() if p["owner"] == pid]
            if rng.random() < 0.4 and mine:
                return {"do": rng.choice(["sell", "mortgage"]), "sq": rng.choice(mine)}
            return {"do": "pay_debt"} if rng.random() < 0.7 else {"do": "bankrupt"}
        if ph == "auction":
            au = v["auction"]
            return {"do": "bid", "amount": au["bid"] + 10000 * rng.randint(1, 20)}
        if ph == "buy":
            return {"do": rng.choice(["buy", "auction"])}
        if ph in ("roll",):
            if v["jail"][pid] >= 0 and rng.random() < 0.3:
                return {"do": "jail_pay"}
            return {"do": "roll"}
        if ph == "manage":
            mine = [int(sq) for sq, p in v["props"].items() if p["owner"] == pid]
            r = rng.random()
            if mine and r < 0.3:
                return {"do": rng.choice(["build", "sell", "mortgage", "unmortgage"]), "sq": rng.choice(mine)}
            if mine and r < 0.35:
                other = rng.choice([p for p in g.ids() if p != pid])
                return {"do": "trade", "to": other, "give": {"props": [rng.choice(mine)], "cash": 0}, "get": {"cash": 100000}}
            return {"do": "end"}
        return {"do": "end"}
    return {}


TURN_GAMES = ["sos", "tictactoe", "connect4", "checkers", "ludo", "ulartangga", "congklak", "sequence", "uno", "gaple",
              "poker", "monopoly"]


@pytest.mark.parametrize("key", TURN_GAMES)
def test_random_play(key):
    cls = GAMES[key]
    for trial in range(25 if key not in ("monopoly", "poker") else 12):
        rng = random.Random(trial * 7919 + len(key))
        n = rng.randint(cls.min_players, cls.max_players)
        opts = {o["key"]: o["default"] for o in cls.options}
        for o in cls.options:
            if o["type"] == "select" and rng.random() < 0.5:
                opts[o["key"]] = rng.choice(o["choices"])[0]
            if o["type"] == "bool" and rng.random() < 0.5:
                opts[o["key"]] = not o["default"]
        if key == "monopoly":
            opts["mode"], opts["minutes"] = "fast", 30
        if key in ("uno", "gaple") and trial % 4:
            opts["target"] = 0  # full 500-point matches of random play are very long
        state = cls.setup(players(n), opts, rng, 0.0)
        g = cls(state, rng)
        now = 0.0
        for step in range(30000):
            if g.over:
                break
            now += 1.0
            g.tick(now)
            if g.over:
                break
            waiting = g.turn()
            if not waiting:
                continue
            pid = rng.choice(waiting)
            try:
                if rng.random() < 0.8:
                    g.act(pid, random_action(key, g, pid, rng), now)
                else:
                    g.on_timeout(now)
            except IllegalMove:
                g.on_timeout(now)
            # Views never crash and never leak other players' hands.
            for p in g.ids():
                v = g.view(p)
                if key in ("uno", "gaple", "sequence") and "hand" in v:
                    assert v["hand"] == g.s["hands"].get(p, [])
            g.view(None)
        assert g.over, f"{key} didn't finish (trial {trial}, {n} players, {step} steps)"
        res = g.results()
        assert sorted(r["id"] for r in res) == sorted(p["id"] for p in players(n)), res
        assert min(r["rank"] for r in res) == 1


def test_poker_hands():
    assert best_hand(["AS", "KS", "QS", "JS", "TS", "2D", "3C"])[0][0] == 8
    assert best_hand(["AS", "2S", "3S", "4S", "5D", "9D", "9C"])[0][:2] == (4, 5)
    assert best_hand(["AS", "AD", "AC", "KS", "KD", "2D", "3C"])[0][0] == 6
    assert best_hand(["2H", "7H", "9H", "JH", "KH", "AD", "AC"])[0][0] == 5


def test_poker_side_pots():
    from bg.games.poker import Poker
    rng = random.Random(1)
    st = Poker.setup(players(3), {"__content": {"stacks": {"p0": 100000, "p1": 300000, "p2": 300000}}}, rng, 0.0)
    g = Poker(st, rng)
    total = sum(st["stacks"].values()) + sum(st["hand"]["contrib"].values())
    for _ in range(3000):
        if g.over:
            break
        g.tick(_ * 1.0)
        w = g.turn()
        if w:
            g.act(w[0], {"do": "allin"} if g.view(w[0])["legal"].get("can_raise") else {"do": "call"}, _ * 1.0)
        live_pot = sum(g.s["hand"]["contrib"].values()) if g.s["phase"] == "hand" else 0
        assert sum(g.s["stacks"].values()) + live_pot == total  # chips are never created or lost


@pytest.mark.parametrize("key", ["math", "anagrams", "penalty"])
def test_timed(key):
    cls = GAMES[key]
    rng = random.Random(5)
    opts = {o["key"]: o["default"] for o in cls.options}
    g = cls(cls.setup(players(3 if key != "penalty" else 2), opts, rng, 0.0), rng)
    now = 0.0
    for _ in range(20000):
        if g.over:
            break
        now += 0.5
        g.tick(now)
        for p in g.ids():
            try:
                if key == "math" and g.s["phase"] == "question":
                    cur = g.s["qs"][g.s["i"]]
                    g.act(p, {"text": cur["answer"].split("|")[0] if rng.random() < 0.5 else "1"}, now)
                if key == "anagrams" and g.s["phase"] == "play":
                    rd = g.s["rounds"][g.s["r"]]
                    g.act(p, {"w": rng.choice(rd["valid"])}, now)
                if key == "penalty" and g.s["phase"] == "choose" and rng.random() < 0.3:
                    g.act(p, {"side": rng.choice("LMR")}, now)
            except IllegalMove:
                pass
    assert g.over


def test_trivia_report_voids_points():
    cls = GAMES["trivia"]
    rng = random.Random(2)
    qs = [{"qid": f"q{i}", "topic": "general", "level": 1 + i // 3, "q": f"Q{i}", "choices": ["a", "b", "c", "d"],
           "answer": 0, "explain": "", "source": "ai"} for i in range(12)]
    g = cls(cls.setup(players(2), {"seconds": 15, "lang": "id", "__content": {"qs": qs}}, rng, 0.0), rng)
    g.tick(3.0)
    g.act("p0", {"c": 0}, 4.0)
    assert g.s["scores"]["p0"] > 0
    ev = g.act("p1", {"do": "report", "reason": "wrong"}, 5.0)
    assert ev[0]["e"] == "report" and g.s["scores"]["p0"] == 0 and 0 in g.s["void"]


def test_snake_runs():
    cls = GAMES["snake"]
    rng = random.Random(3)
    g = cls(cls.setup(players(2), {"bots": 6, "bot_level": 3, "minutes": 2}, rng, 0.0), rng)
    t = 0.0
    for i in range(20 * 60 * 3):
        if g.over:
            break
        t += 0.05
        for p in g.ids():
            g.input(p, {"a": rng.uniform(-3.14, 3.14), "b": rng.random() < 0.1}, t)
        g.step(t)
        assert g.frame() is not None
    assert g.over


def test_lontong_trap_and_answer():
    import random
    from bg.games.quiz import Lontong
    ps = [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]
    g = Lontong(Lontong.setup(ps, {"count": 6}, random.Random(3), 0.0), random.Random(3))
    now = 0.0
    while g.s["phase"] != "question":
        now += 0.5
        g.tick(now)
    cur = g.s["qs"][g.s["i"]]
    if cur.get("traps"):
        ev = g.act("a", {"text": cur["traps"][0]}, now)
        assert ev[0]["e"] == "trap"
    ev = g.act("a", {"text": cur["answer"]}, now + 1)
    assert ev[0]["e"] == "right"
    assert g.view("a")["q"]["words"] == [len(w) for w in cur["answer"].split()]


def test_rebus_tiles_and_reveal():
    import random
    from bg.games.quiz import Rebus
    from bg import content
    qs = [dict(p, qid="x", source="builtin") for p in content.builtin_rebus() if p["lang"] == "id"][:6]
    ps = [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]
    g = Rebus(Rebus.setup(ps, {"__content": {"qs": qs}}, random.Random(1), 0.0), random.Random(1))
    now = 0.0
    while g.s["phase"] != "question":
        now += 0.5
        g.tick(now)
    cur = g.s["qs"][g.s["i"]]
    letters = cur["answer"].upper().replace(" ", "")
    assert sorted(letters) == sorted([c for c in cur["pool"] if c in letters])[:0] or all(cur["pool"].count(c) >= letters.count(c) for c in set(letters))
    g.act("a", {"do": "reveal"}, now)
    assert g.view("a")["revealed"] == {"0": letters[0]}
    g.act("a", {"text": cur["answer"]}, now + 1)
    assert g.s["answers"]["a"]["ok"]


def test_gaple_origin_tracks_first_tile():
    import random
    from bg.games.gaple import Gaple
    ps = [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]
    for seed in range(5):
        g = Gaple(Gaple.setup(ps, {}, random.Random(seed), 0.0), random.Random(seed))
        first = None
        for _ in range(200):
            if g.over or g.s["phase"] != "play":
                break
            pid = g.s["turn"]
            v = g.view(pid)
            if v["can"]:
                i, sides = next(iter(v["can"].items()))
                g.act(pid, {"do": "play", "i": int(i), "side": sides[-1]}, 0)
                if first is None:
                    first = g.s["line"][0]["t"]
            elif v["bone"]:
                g.act(pid, {"do": "draw"}, 0)
            else:
                g.act(pid, {"do": "pass"}, 0)
            if g.s["line"]:
                assert g.s["line"][g.view(pid)["origin"]]["t"] in (first, first[::-1])
