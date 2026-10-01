"""Settings from the environment (systemd EnvironmentFile)."""

import os
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Jakarta")

PB_URL = os.environ.get("BG_PB_URL", "http://127.0.0.1:8090")
PB_USER = os.environ.get("BG_PB_USER", "")
PB_PASSWORD = os.environ.get("BG_PB_PASSWORD", "")

PUBLIC_URL = os.environ.get("BG_PUBLIC_URL", "https://games.bashir.my.id")
STATE_DIR = os.environ.get("BG_STATE_DIR", "/var/lib/bashgames")  # VAPID key

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_FAST_MODEL = os.environ.get("BG_GEMINI_FAST_MODEL", "gemini-3.1-flash-lite")
GEMINI_SMART_MODEL = os.environ.get("BG_GEMINI_SMART_MODEL", "gemini-3.5-flash")

DEV = os.environ.get("BG_DEV", "") == "1"

# Cloudflare Workers AI: backup judge for the photo/drawing games when Gemini is busy (shares the account's free
# daily neurons with the shop, so the games stop using it after BG_CF_DAILY_NEURONS a day).
CF_ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "")
CF_API_TOKEN = os.environ.get("CF_API_TOKEN", "")
CF_VISION_MODELS = [m for m in os.environ.get("BG_CF_VISION_MODELS",
                    "@cf/meta/llama-4-scout-17b-16e-instruct,@cf/google/gemma-4-26b-a4b-it").split(",") if m]
CF_DAILY_NEURONS = float(os.environ.get("BG_CF_DAILY_NEURONS", "2000"))
