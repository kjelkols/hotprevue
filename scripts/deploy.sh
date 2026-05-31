#!/bin/bash
# Oppdater Hotprevue til siste versjon og restart tjenesten.
# Kjøres som root på VM-en: sudo bash scripts/deploy.sh
set -euo pipefail

REPO_DIR="/opt/hotprevue"
HOTPREVUE_USER="hotprevue"
UV_CACHE="/var/lib/hotprevue/.cache/uv"
NPM_CACHE="/var/lib/hotprevue/.cache/npm"

echo "=== Hotprevue deploy ==="

cd "$REPO_DIR"

# ── Hent siste kode ───────────────────────────────────────────────────────────

sudo -u "$HOTPREVUE_USER" git pull --ff-only
echo "✓ git pull"

# ── Python-avhengigheter ──────────────────────────────────────────────────────

cd "$REPO_DIR/backend"
sudo -u "$HOTPREVUE_USER" UV_CACHE_DIR="$UV_CACHE" /usr/local/bin/uv sync
echo "✓ uv sync"

# ── Databasemigrasjoner ───────────────────────────────────────────────────────

DB_URL=$(grep ^DATABASE_URL "$REPO_DIR/backend/.env" | cut -d= -f2-)
sudo -u "$HOTPREVUE_USER" UV_CACHE_DIR="$UV_CACHE" DATABASE_URL="$DB_URL" /usr/local/bin/uv run alembic upgrade head
echo "✓ alembic upgrade head"

# ── Frontend ──────────────────────────────────────────────────────────────────

cd "$REPO_DIR/frontend"
sudo -u "$HOTPREVUE_USER" npm_config_cache="$NPM_CACHE" npm ci
sudo -u "$HOTPREVUE_USER" npm_config_cache="$NPM_CACHE" npm run build:web
echo "✓ Frontend bygd"

# ── Restart ───────────────────────────────────────────────────────────────────

systemctl restart hotprevue
echo "✓ Tjeneste restartet"

echo ""
echo "Status: sudo journalctl -u hotprevue -f"
