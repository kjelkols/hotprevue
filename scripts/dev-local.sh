#!/usr/bin/env bash
# dev-local.sh — åpner tre terminaler for lokal utvikling.
# Bruk: bash scripts/dev-local.sh

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${HOTPREVUE_DATA_DIR:-$HOME/.local/share/hotprevue}"
DB_NAME="$(basename "$DATA_DIR")"
DATABASE_URL="postgresql+psycopg2:///$DB_NAME"
COLDPREVIEW_DIR="$DATA_DIR/coldpreviews"
mkdir -p "$COLDPREVIEW_DIR"

pkill -f 'uvicorn main:app' 2>/dev/null || true
pkill -f 'uvicorn agent.main:app' 2>/dev/null || true
pkill -f 'vite' 2>/dev/null || true

gnome-terminal --title="Backend"  -- bash -c "cd $REPO/backend  && DATABASE_URL=$DATABASE_URL COLDPREVIEW_DIR=$COLDPREVIEW_DIR uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000; exec bash"
gnome-terminal --title="Agent"    -- bash -c "cd $REPO/client   && uv run uvicorn agent.main:app --reload --port 8002; exec bash"
gnome-terminal --title="Frontend" -- bash -c "cd $REPO/frontend && VITE_IS_TEST=true npm run dev:web; exec bash"

sleep 1
wmctrl -r "Backend"  -t 1
wmctrl -r "Agent"    -t 1
wmctrl -r "Frontend" -t 1
