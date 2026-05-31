#!/bin/bash
# Oppdater Hotprevue til siste versjon og restart tjenesten.
# Kjøres som root på VM-en: sudo bash scripts/deploy.sh
set -euo pipefail

REPO_DIR="/opt/hotprevue"
HOTPREVUE_USER="hotprevue"

echo "=== Hotprevue deploy ==="

cd "$REPO_DIR"

# ── Hent siste kode ───────────────────────────────────────────────────────────

sudo -u "$HOTPREVUE_USER" git pull --ff-only
echo "✓ git pull"

# ── Python-avhengigheter ──────────────────────────────────────────────────────

cd "$REPO_DIR/backend"
sudo -u "$HOTPREVUE_USER" /usr/local/bin/uv sync
echo "✓ uv sync"

# ── Frontend ──────────────────────────────────────────────────────────────────

cd "$REPO_DIR/frontend"
sudo -u "$HOTPREVUE_USER" npm ci --silent
sudo -u "$HOTPREVUE_USER" npm run build:web
echo "✓ Frontend bygd"

# ── Restart ───────────────────────────────────────────────────────────────────

systemctl restart hotprevue
echo "✓ Tjeneste restartet"

echo ""
echo "Status: sudo journalctl -u hotprevue -f"
