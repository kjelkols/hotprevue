#!/usr/bin/env bash
# dev-local.sh — start backend og frontend lokalt for rask utvikling.
# Backend: uvicorn med --reload på port 8000
# Frontend: Vite dev-server på port 5173
#
# Engangsoppsett (kjøres én gang):
#   sudo apt install postgresql
#   createdb hotprevue
#
# Bruk: bash scripts/dev-local.sh

set -euo pipefail

REPO_DIR="$(dirname "$0")/.."
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
DB_URL="postgresql+psycopg2:///hotprevue"

# ── Sjekk forutsetninger ──────────────────────────────────────────────────────

if ! command -v psql &>/dev/null; then
  echo "PostgreSQL er ikke installert. Kjør:"
  echo "  sudo apt install postgresql"
  echo "  createdb hotprevue"
  exit 1
fi

if ! psql -lqt 2>/dev/null | cut -d\| -f1 | grep -qw hotprevue; then
  echo "Databasen 'hotprevue' finnes ikke. Kjør:"
  echo "  createdb hotprevue"
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installerer frontend-avhengigheter…"
  cd "$FRONTEND_DIR" && npm ci --silent
fi

# ── Start backend i bakgrunnen ────────────────────────────────────────────────

echo "→ Starter backend på http://localhost:8000"
cd "$BACKEND_DIR"
DATABASE_URL="$DB_URL" uv run uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

cleanup() {
  echo ""
  echo "→ Stopper backend…"
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Vent til backend svarer
for i in $(seq 1 20); do
  sleep 0.5
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ Backend klar"
    break
  fi
done

# ── Start frontend ────────────────────────────────────────────────────────────

echo "→ Starter frontend på http://localhost:5173"
cd "$FRONTEND_DIR"
VITE_IS_TEST=true npm run dev:web
