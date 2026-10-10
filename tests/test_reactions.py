"""Emoji reactions: they play a sound on every phone, so the server lets each player send one every REACT_GAP s.
Run: python -m pytest -q tests"""

import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bg import rooms  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")


def test_reaction_rate_limit(monkeypatch):
    room = rooms.Room("ABCD", "tictactoe", "live", "p0", {})
    sent = []

    async def broadcast(msg, **kw):
        sent.append(msg)

    room.broadcast = broadcast
    clock = [1000.0]
    monkeypatch.setattr(rooms.time, "monotonic", lambda: clock[0])

    async def run():
        await room.handle(None, "p0", {"t": "react", "e": "💩"})
        await room.handle(None, "p0", {"t": "react", "e": "🤡"})        # too soon: dropped
        await room.handle(None, "p1", {"t": "react", "e": "🐔"})        # another player: fine
        clock[0] += rooms.REACT_GAP
        await room.handle(None, "p0", {"t": "react", "e": "🤡"})        # after the gap: fine

    asyncio.run(run())
    assert [(m["from"], m["e"]) for m in sent] == [("p0", "💩"), ("p1", "🐔"), ("p0", "🤡")]


def test_every_reaction_has_a_sound():
    room_js = open(os.path.join(ROOT, "web", "js", "room.js"), encoding="utf-8").read()
    sfx = open(os.path.join(ROOT, "web", "js", "emojisfx.js"), encoding="utf-8").read()
    picks = re.findall(r'"([^"\w\s,]+)"', re.search(r"const REACTIONS = \[([^\]]*)\]", room_js).group(1))
    picks += re.findall(r'"([^"\w\s,]+)"', re.search(r"export const SILLY = \[([^\]]*)\]", sfx).group(1))
    sounds = set(re.findall(r'^\s+"([^"]+)": \(a, d\)', sfx, re.M))
    assert len(picks) == 20 and all(e in sounds for e in picks), [e for e in picks if e not in sounds]
