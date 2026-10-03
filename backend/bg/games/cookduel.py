"""Wok & Roll Duel: everyone cooks the same day (same seed, same customers) in their own 3D kitchen on their own
phone, with their own career kit (equipment, skills, items) unless the host picks a fair duel. The phone reports
its coins (solo-race engine, rate-capped); pranks (a cat, a power cut, rain) and item uses go through the server.
Rewards and used items are written back to each player's career at the end."""

from __future__ import annotations

import logging

from .. import cook
from .base import IllegalMove, ch, opt
from .mp_solo import SoloRace

log = logging.getLogger("bg.cookduel")

PRANKS = {"cat": 0, "blackout": 9.0, "rain": 12.0}   # kind -> base length (s); a cat walks in on its own
PRANK_GAP = 6.0                                       # one prank per player every few seconds at most


class CookDuel(SoloRace):
    key = "cookduel"
    name_id = name_en = "Wok & Roll Duel"
    icon = "🍳"
    min_players, max_players = 2, 4
    mario = False
    party_default = False
    prefetch = False             # kits are read when Start is pressed (fresh gear)
    content_per_player = True
    RATE = 60.0
    MAX = 100_000.0
    options = [
        opt("stage", "Dapur", "Kitchen", "select", 1, [ch(1, "🥩 Bistro Steak", "🥩 Steak bistro"), ch(2, "⛺ Warung Tenda", "⛺ Tent warung")]),
        opt("seconds", "Lama", "Length", "select", 120, [ch(n, f"{n} dtk", f"{n} s") for n in (90, 120, 150)]),
        opt("gear", "Perlengkapan", "Gear", "select", "career", [ch("career", "Dari karier (skill, alat, item)", "From career (skills, gear, items)"),
                                                                 ch("equal", "Setara (semua sama)", "Equal (everyone the same)")]),
    ]

    @classmethod
    async def prepare(cls, seats, options, rng):
        equal = options.get("gear") == "equal"
        kits = {}
        for s in seats:
            try:
                kits[s["id"]] = cook.kit(await cook.load(s["id"], s.get("name", "")), equal=equal)
            except Exception:  # noqa: BLE001 - a missing save never blocks the duel
                log.exception("kit for %s", s["id"])
                kits[s["id"]] = cook.kit(None, equal=equal)
        return {"kits": kits}

    @classmethod
    def setup(cls, players, options, rng, now):
        s = super().setup(players, options, rng, now)
        equal = options.get("gear") == "equal"
        kits = (options.get("__content") or {}).get("kits") or {}
        s.update(stage=int(options.get("stage", 1)) if int(options.get("stage", 1)) in (1, 2) else 1,
                 dur=float(options.get("seconds", 120)) if int(options.get("seconds", 120)) in (90, 120, 150) else 120.0,
                 equal=equal, kits={p["id"]: kits.get(p["id"]) or cook.kit(None, equal=equal) for p in players},
                 used={p["id"]: {} for p in players}, last_prank={}, pranks=[])
        return s

    def begin(self, now):
        ev = super().begin(now)
        self.go("play", now, self.s["dur"] + 4.0)   # +4 s: the phones' "Tutup!" bell and last payments
        return ev

    def view(self, pid):
        v = super().view(pid)
        s = self.s
        v.update(dur=s["dur"], stage=s["stage"], equal=s["equal"], kits=s["kits"], used=s["used"], pranks=s["pranks"][-12:])
        return v

    def act(self, pid, a, now):
        s = self.s
        do = a.get("do")
        if do in ("prank", "item"):
            if s["phase"] != "play" or pid not in s["kits"]:
                raise IllegalMove("Not now.")
        if do == "prank":
            kind, target = a.get("kind"), a.get("target")
            if kind not in PRANKS or target not in s["kits"] or target == pid:
                raise IllegalMove("?")
            if now - s["last_prank"].get(pid, -99) < PRANK_GAP:
                raise IllegalMove("Sabar dulu…")
            s["last_prank"][pid] = now
            dur = round(PRANKS[kind] * float(s["kits"][target].get("resist", 1)), 1)
            p = {"who": pid, "target": target, "kind": kind, "dur": dur, "t": round(now, 2)}
            s["pranks"].append(p)
            self.bump("pranks", pid)
            return [{"e": "prank", **p}]
        if do == "item":
            k = a.get("k")
            have = int(s["kits"][pid].get("items", {}).get(k, 0))
            used = s["used"][pid]
            if k not in cook.ITEMS or used.get(k, 0) >= have or sum(used.values()) >= cook.MAX_ITEM_USES:
                raise IllegalMove("Item habis.")
            used[k] = used.get(k, 0) + 1
            self.bump("items", pid)
            return [{"e": "item", "who": pid, "k": k}]
        return super().act(pid, a, now)

    @classmethod
    async def after_finish(cls, game, room):
        s = game.s
        out = {}
        for r in game.results():
            pid = r["id"]
            try:
                async with cook.lock(pid):
                    save = await cook.load(pid)
                    out[pid] = cook.apply_duel(save, int(r["rank"]), s["used"].get(pid, {}), s["equal"])
                    await cook.store(pid, save)
            except Exception:  # noqa: BLE001
                log.exception("duel reward for %s", pid)
        return {"cook": out}
