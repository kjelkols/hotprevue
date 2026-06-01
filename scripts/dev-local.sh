#!/usr/bin/env bash
# dev-local.sh — start backend, agent og frontend lokalt for rask utvikling.
# Backend: uvicorn --reload på port 8000
# Agent:   uvicorn --reload på port 8002
# Frontend: Vite dev-server på port 5173
#
# Engangsoppsett (kjøres én gang):
#   sudo apt install postgresql
#   createdb hotprevue
#
# Bruk: bash scripts/dev-local.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
AGENT_DIR="$REPO_DIR/client"
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

# ── Cleanup ───────────────────────────────────────────────────────────────────

PIDS=()

cleanup() {
  echo ""
  echo "→ Stopper prosesser…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# ── Start backend ─────────────────────────────────────────────────────────────

echo "→ Starter backend på http://localhost:8000"
cd "$BACKEND_DIR"
DATABASE_URL="$DB_URL" uv run uvicorn main:app --reload --port 8000 &
PIDS+=($!)

for i in $(seq 1 20); do
  sleep 0.5
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ Backend klar"
    break
  fi
done

# ── Start agent ───────────────────────────────────────────────────────────────

echo "→ Starter agent på http://localhost:8002"
cd "$AGENT_DIR"
uv run uvicorn agent.main:app --reload --port 8002 &
PIDS+=($!)

for i in $(seq 1 20); do
  sleep 0.5
  if curl -sf http://localhost:8002/health > /dev/null 2>&1; then
    echo "✓ Agent klar"
    break
  fi
done

# ── Start frontend ────────────────────────────────────────────────────────────

echo "→ Starter frontend på http://localhost:5173"
cd "$FRONTEND_DIR"
VITE_IS_TEST=true npm run dev:web
