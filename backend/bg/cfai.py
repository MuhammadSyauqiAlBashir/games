"""Cloudflare Workers AI (vision) — the backup judge when Gemini is overloaded or out of free quota.

One image per request (the photos are combined into one labelled collage, see vision.py). Neurons used today are
counted in bg_kv `cf_neurons:<date>`; past config.CF_DAILY_NEURONS the games stop asking, so the shop's free FLUX
allowance (same Cloudflare account) is left alone."""

from __future__ import annotations

import base64
import datetime as dt
import json
import logging
import re

from . import ai, config
from .pb import pb

log = logging.getLogger("bg.cfai")
URL = "https://api.cloudflare.com/client/v4/accounts/{acc}/ai/v1/chat/completions"


def configured() -> bool:
    return bool(config.CF_ACCOUNT_ID and config.CF_API_TOKEN)


def _day_key() -> str:
    return "cf_neurons:" + dt.datetime.now(config.TZ).strftime("%Y-%m-%d")


async def used_today() -> float:
    try:
        return float(await pb.kv_get(_day_key(), 0) or 0)
    except Exception:  # noqa: BLE001
        return 0.0


async def _count(neurons: float):
    try:
        await pb.kv_set(_day_key(), round(await used_today() + neurons, 2))
    except Exception as e:  # noqa: BLE001
        log.info("cf neurons not counted: %s", e)


def _json(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0) if m else text)


async def vision_json(prompt: str, jpeg: bytes, schema: dict, max_tokens: int = 700) -> dict:
    """Ask the Cloudflare vision models (in order) for JSON about one image. Raises ai.AIUnavailable."""
    if not configured():
        raise ai.AIUnavailable("Cloudflare AI is not configured.")
    if await used_today() >= config.CF_DAILY_NEURONS:
        raise ai.AIUnavailable("Cloudflare daily budget for games used up.")
    img = "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()
    last = ""
    for model in config.CF_VISION_MODELS:
        body = {"model": model, "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": [{"type": "text", "text": prompt + " Reply with JSON only."},
                                                          {"type": "image_url", "image_url": {"url": img}}]}],
                "response_format": {"type": "json_schema", "json_schema": {"name": "result", "schema": schema}}}
        if "gemma" in model or "qwen" in model:
            body["chat_template_kwargs"] = {"enable_thinking": False}
        try:
            r = await ai.client().post(URL.format(acc=config.CF_ACCOUNT_ID), json=body, timeout=25,
                                       headers={"Authorization": f"Bearer {config.CF_API_TOKEN}"})
            if r.status_code != 200:
                last = f"{model}: HTTP {r.status_code} {r.text[:120]}"
                log.warning("cloudflare fallback: %s", last)
                continue
            j = r.json()
            await _count(float((j.get("usage") or {}).get("neurons") or 0))
            content = ((j.get("choices") or [{}])[0].get("message") or {}).get("content")
            data = content if isinstance(content, dict) else _json(content or "")
            log.info("cloudflare %s answered (%s neurons)", model, (j.get("usage") or {}).get("neurons"))
            return data
        except Exception as e:  # noqa: BLE001 — try the next model
            last = f"{model}: {e}"
            log.warning("cloudflare fallback: %s", last)
    raise ai.AIUnavailable(last or "Cloudflare AI failed")
