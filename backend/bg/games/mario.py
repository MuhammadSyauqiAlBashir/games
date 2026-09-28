"""Shared base for the Mario Party Jamboree–style minigames (and Pesta mode).

Every minigame is a "timed" game driven by phases with deadlines on the game clock:
start (START! banner) → the minigame's own phases → finish (FINISH! banner) → results.
Scores are per-minigame points; placements feed Pesta mode coins."""

from __future__ import annotations

from .base import Game, ch, opt, rank_by_score

START = 2.4    # "START!" banner
FINISH = 2.6   # "FINISH!" banner
PTS = [5, 3, 2, 1]  # points by order for "first correct" style rounds


def rounds_opt(default: int, choices=(3, 5, 7)) -> dict:
    return opt("rounds", "Ronde", "Rounds", "select", default, [ch(n, str(n)) for n in choices])


class Mini(Game):
    kind = "timed"
    loop_dt = 0.05
    min_players, max_players = 2, 4
    mario = True
    party_options: dict = {}   # shorter settings used inside Pesta mode

    # ---- state helpers --------------------------------------------------------------------
    @staticmethod
    def init(players, now, **extra) -> dict:
        return {"players": players, "scores": {p["id"]: 0 for p in players}, "phase": "start",
                "deadline": now + START, "limit": START, "t0": now, "turn_no": 0, **extra}

    def go(self, phase: str, now: float, dur: float | None):
        s = self.s
        s["phase"], s["t0"] = phase, now
        s["deadline"] = None if dur is None else now + dur
        s["limit"] = dur or 0
        s["turn_no"] = int(s.get("turn_no", 0)) + 1

    def tick(self, now):
        s = self.s
        if self.over or s.get("deadline") is None or now < s["deadline"]:
            return self.during(now) if not self.over else []
        return getattr(self, "on_" + s["phase"])(now) or []

    def during(self, now) -> list:
        """Called every tick while a phase runs (for timed reveals)."""
        return []

    def on_start(self, now):
        return self.begin(now)

    def begin(self, now) -> list:
        raise NotImplementedError

    def end(self, now, ranking: list[list[str]] | None = None) -> list:
        self.s["final_rank"] = ranking or rank_by_score(self.ids(), self.s["scores"])
        self.go("finish", now, FINISH)
        return [{"e": "finish"}]

    def on_finish(self, now):
        self.finish(self.s["final_rank"])
        return [{"e": "end"}]

    def turn(self):
        return []

    def mview(self, **extra) -> dict:
        s = self.s
        return {**self.base_view(), "phase": s["phase"], "deadline": s["deadline"], "limit": s["limit"], "t0": s["t0"],
                "scores": s["scores"], "round": s.get("round", 0), "rounds": s.get("rounds", 0), **extra}

    def award_order(self, order: list[str]) -> dict:
        """Points 5/3/2/1 for the players in `order` (first correct first)."""
        got = {}
        for k, pid in enumerate(order):
            pts = PTS[min(k, len(PTS) - 1)]
            self.s["scores"][pid] += pts
            got[pid] = pts
        return got

    def forfeit(self, pid, now):
        others = [p for p in self.ids() if p != pid]
        self.finish(rank_by_score(others, self.s["scores"]) + [[pid]])
        return [{"e": "forfeit", "who": pid}]
