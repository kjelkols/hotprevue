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

echo "Bygger…"
npm run build:web
echo "✓ Bygg ferdig"

echo "Kopierer til $REMOTE:$REMOTE_DIST …"
ssh "$REMOTE" "rm -rf $REMOTE_DIST && mkdir -p $REMOTE_DIST"
scp -r dist/* "$REMOTE:$REMOTE_DIST/"
echo "✓ Filer kopiert"

ssh "$REMOTE" "sudo systemctl restart hotprevue"
echo "✓ Tjeneste restartet"
