#!/usr/bin/env bash
# deploy-backend.sh — pull siste kode, synkroniser avhengigheter, migrer, restart.
#
# Bruk: bash scripts/deploy-backend.sh [user@host]
# Standard: kjell@100.121.142.64

set -euo pipefail

REMOTE="${1:-kjell@100.121.142.64}"

echo "→ Deployer backend til $REMOTE…"

ssh "$REMOTE" bash << 'EOF'
set -euo pipefail
cd /opt/hotprevue
git pull --quiet
cd backend
uv sync --quiet
DATABASE_URL=postgresql+psycopg2:///hotprevue uv run alembic upgrade head
sudo systemctl restart hotprevue
echo "✓ Backend deployet"
EOF
