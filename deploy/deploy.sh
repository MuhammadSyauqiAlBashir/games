#!/usr/bin/env bash
# Deploy BashGames from this repo. Safe to re-run.
#   backend -> /opt/bashgames (root-owned; runs as user bashgames)
#   web     -> /srv/bashgames (static, served by Caddy)
#   pb      -> /var/lib/pocketbase/{pb_migrations,pb_hooks} (applied on PocketBase restart)
# First time: run deploy/setup-secrets.sh after this.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo dev)-$(date +%Y%m%d%H%M%S)"
echo "==> bashgames $VERSION"
id bashgames >/dev/null 2>&1 || sudo useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin bashgames

echo "==> backend"
sudo install -d -o root -g root -m 755 /opt/bashgames
[ -x /opt/bashgames/venv/bin/python ] || sudo python3 -m venv /opt/bashgames/venv
sudo /opt/bashgames/venv/bin/pip install --quiet --disable-pip-version-check -r backend/requirements.txt
sudo rsync -a --delete --chown=root:root --chmod=D755,F644 --exclude __pycache__ backend/bg/ /opt/bashgames/bg/
sudo install -o root -g root -m 644 deploy/bashgames.service /etc/systemd/system/bashgames.service

echo "==> web"
STAGE="$(mktemp -d)"
trap 'rm -rf -- "$STAGE"' EXIT
cp -r web/. "$STAGE/"
{ grep -rl __VERSION__ "$STAGE" --include=*.js --include=*.html --include=*.css || true; } | xargs -r sed -i "s/__VERSION__/$VERSION/g"
sudo install -d -o root -g root -m 755 /srv/bashgames
sudo rsync -a --delete --chown=root:root --chmod=D755,F644 "$STAGE/" /srv/bashgames/

echo "==> pocketbase migrations + hooks"
sudo install -C -o pocketbase -g pocketbase -m 640 pb_migrations/*.js /var/lib/pocketbase/pb_migrations/
sudo install -C -o pocketbase -g pocketbase -m 640 pb_hooks/*.js /var/lib/pocketbase/pb_hooks/

echo "==> restart"
sudo systemctl daemon-reload
if [ "${SKIP_PB_RESTART:-0}" != 1 ]; then sudo systemctl restart pocketbase; sleep 2; fi
if [ -f /etc/bashgames/env ]; then
  sudo chown root:bashgames /etc/bashgames/env && sudo chmod 640 /etc/bashgames/env
  sudo systemctl enable --quiet bashgames
  sudo systemctl restart bashgames
  for i in $(seq 30); do curl -fsS http://127.0.0.1:8300/api/health >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS http://127.0.0.1:8300/api/health && echo
else
  echo "!! /etc/bashgames/env missing: run deploy/setup-secrets.sh"
fi
systemctl is-active pocketbase
echo "==> done: $VERSION"
