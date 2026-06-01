#!/bin/bash
# Bygg frontend lokalt og kopier dist/ til serveren via scp.
# Mye raskere enn å bygge på serveren — npm ci kjøres ikke der.
#
# Bruk: bash scripts/deploy-frontend-local.sh [user@host]
# Standard: kjell@100.121.142.64

set -euo pipefail

REMOTE="${1:-kjell@100.121.142.64}"
REMOTE_DIST="/opt/hotprevue/frontend/dist"

cd "$(dirname "$0")/../frontend"

if [ ! -d node_modules ]; then
  echo "Installerer avhengigheter…"
  npm ci
fi

BUILD_NUMBER=$(git rev-list --count HEAD 2>/dev/null || echo 0)
echo "Bygger… (build #$BUILD_NUMBER)"
VITE_BUILD_NUMBER=$BUILD_NUMBER VITE_IS_TEST=true npm run build:web
echo "✓ Bygg ferdig"

echo "Kopierer til $REMOTE:$REMOTE_DIST …"
ssh "$REMOTE" "rm -rf $REMOTE_DIST && mkdir -p $REMOTE_DIST"
tar -C dist -czf - . | ssh "$REMOTE" "tar -C $REMOTE_DIST -xzf -"
echo "✓ Filer kopiert"

ssh "$REMOTE" "sudo systemctl restart hotprevue"
echo "✓ Tjeneste restartet"
