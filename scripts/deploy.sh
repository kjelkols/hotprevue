#!/usr/bin/env bash
# deploy.sh — kjør tester, bygg og send til produksjonsserver.
# Bruk: bash scripts/deploy.sh user@host
set -euo pipefail

REMOTE="${1:?Bruk: bash scripts/deploy.sh user@host}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

# ── Tester ────────────────────────────────────────────────────────────────────

echo "→ Kjører backend-tester…"
cd "$REPO/backend"
uv run pytest --tb=short -q
echo "✓ Tester bestått"

# ── Frontend ──────────────────────────────────────────────────────────────────

echo "→ Bygger frontend…"
cd "$REPO/frontend"
BUILD_NUMBER=$(git rev-list --count HEAD 2>/dev/null || echo 0)
VITE_BUILD_NUMBER="$BUILD_NUMBER" npm run build:web
echo "✓ Frontend bygd (build #$BUILD_NUMBER)"

# ── Send backend ──────────────────────────────────────────────────────────────

echo "→ Sender backend…"
ssh "$REMOTE" "mkdir -p /opt/hotprevue/backend"
tar -C "$REPO/backend" \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.pytest_cache' \
    --exclude='*.egg-info' \
    -czf - . | ssh "$REMOTE" "tar -C /opt/hotprevue/backend -xzf -"

# ── Send frontend ─────────────────────────────────────────────────────────────

echo "→ Sender frontend…"
ssh "$REMOTE" "rm -rf /opt/hotprevue/frontend/dist && mkdir -p /opt/hotprevue/frontend/dist"
tar -C "$REPO/frontend/dist" -czf - . | \
    ssh "$REMOTE" "tar -C /opt/hotprevue/frontend/dist -xzf -"

# ── Synkroniser og restart ────────────────────────────────────────────────────

echo "→ Synkroniserer avhengigheter og migrerer…"
ssh "$REMOTE" bash << 'EOF'
set -euo pipefail
cd /opt/hotprevue/backend
uv sync --quiet
DATABASE_URL=postgresql+psycopg2:///hotprevue uv run alembic upgrade head
sudo systemctl restart hotprevue
EOF

echo "✓ Produksjon oppdatert (build #$BUILD_NUMBER)"
