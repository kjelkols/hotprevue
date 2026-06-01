#!/bin/bash
# Start lokal Vite-dev-server mot kjørende backend på VM-en.
# API-kall proxyes automatisk — ingen CORS-problemer.
# Åpne http://localhost:5173 i nettleser.
#
# Bruk: bash scripts/dev.sh [backend-url]
# Standard backend: http://100.121.142.64:8000

set -euo pipefail

BACKEND="${1:-http://100.121.142.64:8000}"

cd "$(dirname "$0")/../frontend"

if [ ! -d node_modules ]; then
  echo "Installerer avhengigheter…"
  npm ci
fi

echo "Dev-server → $BACKEND"
VITE_BACKEND_URL="$BACKEND" npm run dev:web
