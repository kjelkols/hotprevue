#!/usr/bin/env bash
# dev-local.sh — åpner tre terminaler for lokal utvikling.
# Bruk: bash scripts/dev-local.sh

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${HOTPREVUE_DATA_DIR:-$HOME/.local/share/hotprevue}"
DB_NAME="$(basename "$DATA_DIR")"
DATABASE_URL="postgresql+psycopg2:///$DB_NAME?host=/run/postgresql"
COLDPREVIEW_DIR="$DATA_DIR/coldpreviews"
mkdir -p "$COLDPREVIEW_DIR"

pkill -f 'uvicorn main:app' 2>/dev/null || true
pkill -f 'uvicorn agent.main:app' 2>/dev/null || true
pkill -f 'vite' 2>/dev/null || true

SESSION="hotprevue"
if ! tmux new-session -d -s "$SESSION" -x 220 -y 50 2>/dev/null; then
    tmux kill-session -t "$SESSION"
    tmux new-session -d -s "$SESSION" -x 220 -y 50
fi

tmux rename-window -t "$SESSION:0" "Backend"
tmux send-keys -t "$SESSION:Backend" "cd $REPO/backend && DATABASE_URL=$DATABASE_URL COLDPREVIEW_DIR=$COLDPREVIEW_DIR AI_SEARCH_URL=http://tenketank.tail764ab5.ts.net:8001 uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000" Enter

tmux new-window -t "$SESSION" -n "Agent"
tmux send-keys -t "$SESSION:Agent" "cd $REPO/client && uv run uvicorn agent.main:app --reload --port 8002" Enter

tmux new-window -t "$SESSION" -n "Frontend"
tmux send-keys -t "$SESSION:Frontend" "cd $REPO/frontend && VITE_IS_TEST=true npm run dev:web" Enter

tmux select-window -t "$SESSION:Backend"
tmux attach-session -t "$SESSION"
