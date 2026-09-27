"""Small shared helpers."""

from __future__ import annotations

import re
import secrets
import time
import unicodedata
from collections import defaultdict, deque
from datetime import datetime

from fastapi import HTTPException

from . import config

PB_ID = re.compile(r"^[a-z0-9]{15}$")


def rid(value: str) -> str:
    if not PB_ID.match(value or ""):
        raise HTTPException(404, "Not found.")
    return value


def new_id(n: int = 10) -> str:
    return secrets.token_urlsafe(n)[:n]


def now_local() -> datetime:
    return datetime.now(config.TZ)


def today() -> str:
    return now_local().strftime("%Y-%m-%d")


def month() -> str:
    return now_local().strftime("%Y-%m")


def pb_now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.000Z")


def norm(text: str) -> str:
    """Lowercase, no accents, only letters/digits/spaces — for comparing typed answers."""
    s = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def lev(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def close_enough(guess: str, answer: str) -> tuple[bool, bool]:
    """(correct, almost) with small typos forgiven for longer answers."""
    g, a = norm(guess), norm(answer)
    if not g:
        return False, False
    if g == a or g.replace(" ", "") == a.replace(" ", ""):
        return True, False
    d = lev(g.replace(" ", ""), a.replace(" ", ""))
    allowed = 0 if len(a) <= 4 else 1 if len(a) <= 8 else 2
    if d <= allowed:
        return True, False
    return False, d <= allowed + 2


class Window:
    def __init__(self, limit: int, seconds: float):
        self.limit, self.seconds = limit, seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, what: str = "requests"):
        now = time.monotonic()
        dq = self.hits[key]
        while dq and now - dq[0] > self.seconds:
            dq.popleft()
        if len(dq) >= self.limit:
            wait = int(self.seconds - (now - dq[0])) + 1
            raise HTTPException(429, {"error": f"Too many {what}. Try again in {wait}s.", "retry_after": wait})
        dq.append(now)
