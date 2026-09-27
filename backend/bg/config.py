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
