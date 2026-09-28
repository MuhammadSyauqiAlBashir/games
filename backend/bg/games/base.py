"""The contract every game follows.

The server is the referee: it keeps the whole game state in `self.s` (a JSON-able
dict, so rooms survive a restart), rolls dice and shuffles with `self.rng`, checks
every move, and shows each player only what they may see (`view`).

Time is the room's *game clock* (seconds that stop while the room is paused), so
timers freeze when someone disconnects.

Kinds:
- "turn":     classic turn-based games (the room adds an optional turn timer).
- "timed":    rounds with deadlines (trivia, drawing…); `tick()` advances phases.
- "realtime": a fixed-rate simulation (snake); `step()` runs `tick_hz` times a second.
"""

from __future__ import annotations

import random
from typing import Any


class IllegalMove(Exception):
    """A move the rules don't allow; the message is shown to the player."""


def opt(key: str, label_id: str, label_en: str, type_: str, default: Any, choices: list | None = None,
        min_: int | None = None, max_: int | None = None, help_id: str = "", help_en: str = "") -> dict:
    """An option shown in the room settings."""
    d = {"key": key, "label_id": label_id, "label_en": label_en, "type": type_, "default": default}
    if choices is not None:
        d["choices"] = choices  # [[value, label_id, label_en], ...]
    if min_ is not None:
        d["min"] = min_
    if max_ is not None:
        d["max"] = max_
    if help_id:
        d["help_id"], d["help_en"] = help_id, help_en
    return d


def ch(value: Any, label_id: str, label_en: str | None = None) -> list:
    return [value, label_id, label_en if label_en is not None else label_id]


class Game:
    key = ""
    name_id = ""
    name_en = ""
    icon = "🎲"
    min_players = 2
    max_players = 4
    kind = "turn"
    santai_ok = False          # may be played in "Santai" (asynchronous) mode
    teams = False
    tick_hz = 0
    default_timer = 60         # suggested turn timer (seconds, 0 = off) when the global default is used
    options: list[dict] = []

    def __init__(self, state: dict, rng: random.Random):
        self.s = state
        self.rng = rng

    # ---- lifecycle ---------------------------------------------------------
    @classmethod
    def setup(cls, players: list[dict], options: dict, rng: random.Random, now: float) -> dict:
        """Initial state. players: [{id, name, team}] in seat order."""
        raise NotImplementedError

    def view(self, pid: str | None) -> dict:
        raise NotImplementedError

    def act(self, pid: str, a: dict, now: float) -> list[dict]:
        raise NotImplementedError

    # ---- turns and time ------------------------------------------------------
    def turn(self) -> list[str]:
        """Players the game is waiting for (for timers and 'your turn' pushes)."""
        cur = self.s.get("turn")
        return [cur] if cur and not self.s.get("over") else []

    def turn_no(self) -> int:
        """Changes whenever a new decision is expected (resets the turn timer)."""
        return int(self.s.get("turn_no", 0))

    def anim_seconds(self, events: list[dict]) -> float:
        """Extra turn-timer seconds while the clients replay these events (slow animations)."""
        return 0.0

    def on_timeout(self, now: float) -> list[dict]:
        """The turn timer ran out: make a safe automatic move for the waiting player."""
        return []

    def tick(self, now: float) -> list[dict]:
        """Timed games: advance phases whose deadline passed."""
        return []

    def step(self, now: float) -> None:
        """Realtime games: one simulation step."""

    def input(self, pid: str, data: dict, now: float) -> None:
        """Realtime games: steering input (no reply)."""

    # ---- the end ---------------------------------------------------------------
    @property
    def over(self) -> bool:
        return bool(self.s.get("over"))

    def results(self) -> list[dict]:
        """[{id, rank (1 = best), score, team}] once the game is over."""
        return self.s.get("results", [])

    def stats(self) -> dict:
        """Per-player counters for awards: {"sixes": {pid: n}, ...}."""
        return self.s.get("stats", {})

    def forfeit(self, pid: str, now: float) -> list[dict]:
        """A player leaves for good. Default: the game ends, they rank last."""
        others = [p["id"] for p in self.s["players"] if p["id"] != pid]
        scores = self.s.get("scores", {})
        ranked = sorted(others, key=lambda x: -scores.get(x, 0))
        self.finish([[x] for x in ranked] + [[pid]])
        return [{"e": "forfeit", "who": pid}]

    # ---- helpers ----------------------------------------------------------------
    def players(self) -> list[dict]:
        return self.s["players"]

    def ids(self) -> list[str]:
        return [p["id"] for p in self.s["players"]]

    def name(self, pid: str) -> str:
        return next((p["name"] for p in self.s["players"] if p["id"] == pid), "?")

    def next_turn(self, pid: str | None = None):
        self.s["turn"] = pid
        self.s["turn_no"] = int(self.s.get("turn_no", 0)) + 1

    def finish(self, ranking: list[list[str]], scores: dict | None = None):
        """ranking: groups of player ids, best first (ties share a group)."""
        sc = scores if scores is not None else self.s.get("scores", {})
        teams = {p["id"]: p.get("team") for p in self.s["players"]}
        res, rank = [], 1
        for group in ranking:
            for pid in group:
                res.append({"id": pid, "rank": rank, "score": sc.get(pid, 0), "team": teams.get(pid)})
            rank += len(group)
        self.s["results"] = res
        self.s["over"] = True
        self.s["turn"] = None

    def bump(self, stat: str, pid: str, n: int = 1):
        st = self.s.setdefault("stats", {}).setdefault(stat, {})
        st[pid] = st.get(pid, 0) + n

    def base_view(self) -> dict:
        return {"turn": self.s.get("turn"), "turn_no": self.turn_no(), "over": self.over,
                "results": self.s.get("results", []) if self.over else []}


def rank_by_score(ids: list[str], scores: dict) -> list[list[str]]:
    """Groups of tied players, highest score first."""
    groups: dict[int | float, list[str]] = {}
    for pid in ids:
        groups.setdefault(scores.get(pid, 0), []).append(pid)
    return [groups[k] for k in sorted(groups, reverse=True)]
