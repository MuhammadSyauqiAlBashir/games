"""Voice games: karaoke scoring and the record → playback → AI/vote flow.
Run: python -m pytest -q tests"""

import asyncio
import io
import math
import os
import random
import struct
import sys
import wave

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bg import ai, pitch  # noqa: E402
from bg.games import GAMES, IllegalMove  # noqa: E402
from bg.games.sing import songs  # noqa: E402


def players(n):
    return [{"id": f"p{i}", "name": f"P{i}", "team": i, "avatar": "🐱", "color": "#888"} for i in range(n)]


def make(key, n, opts=None, seed=1):
    cls = GAMES[key]
    rng = random.Random(seed)
    return cls(cls.setup(players(n), opts or {}, rng, 0.0), rng)


def wav(secs=1.0, rate=16000):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(i / 10))) for i in range(int(secs * rate))))
    return buf.getvalue()


def test_song_bank():
    for s in songs():
        assert 6 <= s["seconds"] <= 13 and all(len(n) == 3 for n in s["notes"])
        ref = pitch.melody_frames(s["notes"], s["bpm"])
        assert pitch.score(s["notes"], s["bpm"], ref)["score"] == 100
        assert pitch.score(s["notes"], s["bpm"], [v and v + 7 for v in ref])["score"] == 100  # another key
        rnd = random.Random(1)
        assert pitch.score(s["notes"], s["bpm"], [rnd.uniform(50, 80) for _ in ref])["score"] < 45


def test_karaoke_flow():
    g = make("karaoke", 3, {"rounds": 2})
    t, sang = 0.0, []
    while not g.over and t < 600:
        g.tick(t)
        s = g.s
        if s["phase"] == "sing" and s["turn"] not in sang and t > s["t0"] + 4:
            song = s["songs"][s["r"]]
            ref = pitch.melody_frames(song["notes"], song["bpm"])
            who = s["turn"]
            g.act(who, {"do": "live", "i": 0, "f": ref[:20]}, t)
            if who == "p2":
                pass  # p2 never sends the final line: the live part counts at the deadline
            else:
                g.act(who, {"do": "sung", "f": ref if who == "p0" else [None] * len(ref)}, t)
            sang.append(who)
        if s["phase"] in ("intro", "result"):
            sang = []
        t += 0.25
    assert g.over
    sc = g.s["scores"]
    assert sc["p0"] == 200 and sc["p1"] == 0 and 0 < sc["p2"] < 200
    assert g.results()[0]["id"] == "p0"


def run_voice(g, judge, t_max=900):
    t = 0.0
    while not g.over and t < t_max:
        g.tick(t)
        s = g.s
        if s["phase"] == "prep" and s["title"] == "":
            g.act(s["dj"], {"do": "title", "t": "Sial - Mahalini"}, t)
            g.server_input(s["dj"], {"do": "clip", "r": s["r"] + 1, "slot": "ref", "secs": 10.2}, t)
            g.provide(s["ai_need"], {"lyrics": "la la"}, t)
            g.act(s["dj"], {"do": "go"}, t)
        if s["phase"] == "rec" and t > s["t0"] + 4:
            if s["turn"] == "p1" and s["r"] == 0:
                g.act("p1", {"do": "skip"}, t)
            else:
                g.server_input(s["turn"], {"do": "clip", "r": s["r"] + 1, "slot": "me", "secs": 5}, t)
        if s["ai_need"] and s["ai_need"]["kind"] == "judge":
            g.provide(s["ai_need"], judge(s["ai_need"]), t)
        if s["phase"] == "vote":
            ids = list(s["clips"])
            for p in g.ids():
                if p not in s["votes"]:
                    g.act(p, {"do": "vote", "pid": next(q for q in ids if q != p)}, t)
        t += 0.25
    assert g.over
    return g


def test_tirusuara_ai_and_vote():
    calls = []

    def judge(need):
        calls.append(need)
        if len(calls) == 2:
            return None  # AI busy → vote round
        return {"ranking": [{"id": p, "score": 90 - 10 * i, "comment": "x"} for i, p in enumerate(need["ids"])]}

    g = run_voice(make("tirusuara", 3, {"rounds": 3}), judge)
    assert len(calls) == 3 and sum(g.s["scores"].values()) > 0
    assert "p1" not in calls[0]["ids"]  # skipped their turn in round 1


def test_nyanyihits_prep_and_ref():
    g = make("nyanyihits", 2, {"rounds": 2})
    g = run_voice(g, lambda need: {"ranking": [{"id": p, "score": 70, "comment": "ok"} for p in need["ids"]]})
    assert g.s["scores"] == {"p0": 300, "p1": 200}  # round 1 only p0 sang; round 2 equal AI scores share points
    with __import__("pytest").raises(IllegalMove):
        g2 = make("nyanyihits", 2)
        t = 0.0
        while g2.s["phase"] != "prep":
            g2.tick(t)
            t += 0.5
        g2.act(g2.s["dj"], {"do": "go"}, t)  # no title and no clip yet
    assert g2.audio_ok(g2.s["dj"], 1, "ref") is None and g2.audio_ok("p1" if g2.s["dj"] == "p0" else "p0", 1, "ref")


def test_voice_fulfil_room_builds_parts(monkeypatch):
    seen = {}

    async def fake(parts, **k):
        seen["n"] = sum(1 for p in parts if isinstance(p, dict))
        return {"ranking": [{"label": "A", "score": 80, "comment": "mantap"}, {"label": "B", "score": 40, "comment": "hmm"}]}

    monkeypatch.setattr(ai, "generate", fake)

    class Room:
        photos = {"a1:ref": wav(), "a1:p0": wav(), "a1:p1": wav()}

    need = {"kind": "judge", "r": 1, "ids": ["p0", "p1"], "item": {"title": ""}, "lang": "id", "ref": True, "title": "X"}
    res = asyncio.run(GAMES["nyanyihits"].fulfil_room(need, {}, Room()))
    assert seen["n"] == 3 and res["ranking"][0] == {"id": "p0", "score": 80, "comment": "mantap"}
