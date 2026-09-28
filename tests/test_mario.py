"""Random-play simulations for the Mario minigames and Pesta mode."""

import random

import pytest

from bg.games.base import IllegalMove
from bg.games.pesta import MINIS, MINIS2, Pesta


def players(n):
    return [{"id": f"p{i}", "name": f"P{i}", "team": i} for i in range(n)]


def moves_for(g, pid, rng):
    """Plausible actions for any minigame (some will be illegal; that's fine)."""
    v = g.view(pid)
    k = g.key if g.key != "mp_pesta" else (g.s["sub"] or {}).get("key")
    now_moves = [{"do": "ready"}]
    if k == "mp_thwomp":
        now_moves.append({"i": rng.randrange(max(1, v.get("n", 3)))})
    elif k == "mp_bigtop":
        now_moves.append({"i": rng.randrange(4)})
    elif k == "mp_buzzer":
        now_moves.append({"i": rng.randrange(4)})
    elif k == "mp_shell":
        now_moves.append({"slot": rng.randrange(3)})
    elif k == "mp_turntable":
        now_moves += [{"b": rng.randrange(2)}, {"do": "lock"}]
    elif k == "mp_pound":
        now_moves.append({"hole": rng.randrange(4)})
    elif k == "mp_sled":
        now_moves.append({"t": 1e9})
    elif k == "mp_fish":
        now_moves.append({"rt": rng.uniform(0.15, 0.6)})
    elif k == "mp_flower":
        now_moves.append({"pose": rng.choice(["stand", "squat"])})
    elif k == "mp_memory":
        now_moves.append({"door": rng.randrange(16)})
    elif k == "mp_circuit":
        now_moves += [{"i": rng.randrange(25)} for _ in range(5)]
    elif k == "mp_blocks":
        now_moves.append({"i": rng.randrange(4)})
    elif k == "mp_shadow":
        now_moves.append({"a": rng.randrange(8), "b": rng.randrange(8)})
    elif k in ("mp_floor",):
        now_moves.append({"d": rng.choice("udlr")})
    elif k in ("mp_hop",):
        now_moves.append({"t": 1e9})
    elif k in ("mp_stamp", "mp_flags", "mp_sunset"):
        now_moves.append({"a": rng.uniform(-3.14, 3.14), "m": 1})
    elif k == "mp_arm":
        now_moves.append({"n": rng.randrange(1, 6)})
    elif k == "mp_rope":
        now_moves += [{"h": "L"}, {"h": "R"}]
    elif k == "mp_slappy":
        now_moves += [{"do": "slap"}, {"t": 1e9}]
    elif k and k.startswith("mp_"):
        now_moves.append({"v": rng.uniform(0, 400), "done": rng.random() < 0.05})
    return now_moves


def run(cls, n, seed, options=None, limit=6000):
    rng = random.Random(seed)
    grng = random.Random(seed + 1)
    ps = players(n)
    g = cls(cls.setup(ps, options or {}, grng, 0.0), grng)
    now = 0.0
    for _ in range(limit):
        if g.over:
            break
        now += 0.1
        g.tick(now)
        if rng.random() < 0.3 and not g.over:
            pid = rng.choice(ps)["id"]
            for a in moves_for(g, pid, rng):
                try:
                    g.act(pid, a, now)
                except IllegalMove:
                    pass
                if g.over:
                    break
        for pid in g.ids():
            g.view(pid)
    return g


@pytest.mark.parametrize("cls", MINIS + MINIS2, ids=lambda c: c.key)
@pytest.mark.parametrize("n", [2, 3, 4])
def test_minigame_finishes(cls, n):
    for seed in range(3):
        g = run(cls, n, seed, limit=30000)
        assert g.over, f"{cls.key} n={n} seed={seed} stuck in {g.s['phase']}"
        ranks = [r["rank"] for r in g.results()]
        assert sorted(r["id"] for r in g.results()) == sorted(g.ids())
        assert min(ranks) == 1


@pytest.mark.parametrize("n", [2, 3, 4])
def test_pesta_runs(n):
    g = run(Pesta, n, 7, {"count": 10, "games": [m.key for m in MINIS + MINIS2]}, limit=60000)
    assert g.over, g.s["phase"]
    assert len(g.s["places"]["p0"]) == 10
    assert sum(g.s["coins"].values()) > 0


def test_sled_physics():
    from bg.games.mp_reflex import SledToTheEdge
    ice = {"a": 6.0, "mu": 7.5}
    d, slide = SledToTheEdge.travel(ice, 4.0)
    assert 80 < d < 100 and 3 < slide < 4
