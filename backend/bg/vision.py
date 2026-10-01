"""Photo helpers for the AI judges: a labelled collage (one image for models that take only one), the race
between Gemini and the Cloudflare backup."""

from __future__ import annotations

import asyncio
import io
import logging
import math
from typing import Awaitable, Callable

from PIL import Image, ImageDraw, ImageFont

from . import ai

log = logging.getLogger("bg.vision")


def collage(items: list[tuple[str, bytes]], tile: int = 384) -> bytes:
    """[(label, image bytes)] → one JPEG grid, each tile with a big black label badge in its top-left corner."""
    n = len(items)
    cols = 1 if n == 1 else 2 if n <= 4 else 3
    rows = math.ceil(n / cols)
    grid = Image.new("RGB", (cols * tile, rows * tile), "white")
    draw = ImageDraw.Draw(grid)
    font = ImageFont.load_default(size=int(tile * 0.11))
    for i, (label, data) in enumerate(items):
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im.thumbnail((tile - 8, tile - 8))
        x, y = (i % cols) * tile, (i // cols) * tile
        grid.paste(im, (x + (tile - im.width) // 2, y + (tile - im.height) // 2))
        b = int(tile * 0.16)
        draw.rectangle((x, y, x + b, y + b), fill="black")
        draw.text((x + b // 2, y + b // 2), label, fill="white", font=font, anchor="mm")
    out = io.BytesIO()
    grid.save(out, "JPEG", quality=82)
    return out.getvalue()


async def race(gemini: Callable[[], Awaitable[dict]], backup: Callable[[], Awaitable[dict]] | None, budget: float = 30.0,
               head_start: float = 7.0) -> dict | None:
    """Gemini first; if it hasn't answered after `head_start` s (or failed), the Cloudflare backup runs alongside.
    Each side retries while time is left. The first good answer wins; None if nothing came back within `budget`."""
    loop = asyncio.get_running_loop()
    end = loop.time() + budget

    async def keep_trying(fn, name, pause):
        k = 0
        while loop.time() < end - 3:
            k += 1
            try:
                return await asyncio.wait_for(fn(), timeout=max(1.0, end - loop.time()))
            except (ai.AIUnavailable, asyncio.TimeoutError, ValueError, KeyError) as e:
                log.warning("%s judge try %d failed: %s", name, k, str(e)[:160] or type(e).__name__)
                if "budget" in str(e) or "not configured" in str(e):
                    return None
            await asyncio.sleep(min(pause, max(0.0, end - loop.time() - 3)))
        return None

    tasks = {asyncio.create_task(keep_trying(gemini, "gemini", 3))}
    started_backup = backup is None
    try:
        while tasks and loop.time() < end:
            wait = head_start if not started_backup else end - loop.time()
            done, _ = await asyncio.wait(tasks, timeout=max(0.1, min(wait, end - loop.time())), return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                tasks.discard(t)
                res = t.result()
                if res is not None:
                    return res
            if not started_backup:
                started_backup = True
                tasks.add(asyncio.create_task(keep_trying(backup, "cloudflare", 2)))
        return None
    finally:
        for t in tasks:
            t.cancel()
