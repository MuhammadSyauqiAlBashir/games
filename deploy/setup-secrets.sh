#!/usr/bin/env bash
# One-time (re-runnable): create the PocketBase machine login svc_bashgames (role games) with a random
# 48-character password and write /etc/bashgames/env (root:bashgames 640). Copies the Gemini key from
# the finance app. Prints no secrets.
set -euo pipefail
PB="/opt/pocketbase/pocketbase"
PBARGS=(--dir /var/lib/pocketbase/pb_data --hooksDir /var/lib/pocketbase/pb_hooks --migrationsDir /var/lib/pocketbase/pb_migrations)
PASS="$(openssl rand -hex 24)"
CRED="$(sudo mktemp /tmp/bg-XXXXXX.cred)"
printf 'svc_bashgames\n%s\n' "$PASS" | sudo tee "$CRED" >/dev/null
sudo chown pocketbase "$CRED"
sudo -u pocketbase "$PB" games-service "$CRED" "${PBARGS[@]}"
sudo shred -u "$CRED"
GEMINI="$(sudo grep -E '^GEMINI_API_KEY=' /etc/finance/env | head -1 | cut -d= -f2- || true)"
sudo install -d -o root -g root -m 755 /etc/bashgames
umask 077
printf 'BG_PB_USER=svc_bashgames\nBG_PB_PASSWORD=%s\nGEMINI_API_KEY=%s\n' "$PASS" "$GEMINI" | sudo tee /etc/bashgames/env >/dev/null
sudo chown root:bashgames /etc/bashgames/env && sudo chmod 640 /etc/bashgames/env
# Cloudflare Workers AI (backup photo/drawing judge): reuse the shop's account + token if present
if sudo test -f /etc/couple-suits/admin.env; then
  sudo grep -E '^CF_(ACCOUNT_ID|API_TOKEN)=' /etc/couple-suits/admin.env | sudo tee -a /etc/bashgames/env >/dev/null || true
fi
echo "secrets ready: /etc/bashgames/env (Gemini: $([ -n "$GEMINI" ] && echo yes || echo NO))"
