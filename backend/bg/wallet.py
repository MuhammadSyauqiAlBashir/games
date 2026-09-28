"""Poker wallets: everyone gets Rp1.000.000 of play money per day (reset 00:00 WIB).
Lose it all and you sit out until tomorrow."""

from __future__ import annotations

from . import util
from .pb import pb, q

DAILY = 1_000_000


async def balance(uid: str) -> int:
    day = util.today()
    rec = await pb.first("bg_wallets", f"user = {q(uid)} && day = {q(day)}")
    if not rec:
        rec = await pb.create("bg_wallets", {"user": uid, "day": day, "balance": DAILY})
    return int(rec["balance"])


async def set_balance(uid: str, amount: int):
    day = util.today()
    rec = await pb.first("bg_wallets", f"user = {q(uid)} && day = {q(day)}")
    if rec:
        await pb.update("bg_wallets", rec["id"], {"balance": max(0, int(amount))})
    else:
        await pb.create("bg_wallets", {"user": uid, "day": day, "balance": max(0, int(amount))})
