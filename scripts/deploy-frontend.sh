#!/bin/bash
# Bygger kun frontend og restarter tjenesten. Brukes når kun frontend er endret.
# Kjøres på VM-en: ssh -t kjell@VM "cd /opt/hotprevue && sudo bash scripts/deploy-frontend.sh"
set -euo pipefail

REPO_DIR="/opt/hotprevue"
HOTPREVUE_USER="hotprevue"
NPM_CACHE="/var/lib/hotprevue/.cache/npm"

echo "=== Hotprevue frontend-deploy ==="

cd "$REPO_DIR"
sudo -u "$HOTPREVUE_USER" git pull --ff-only
echo "✓ git pull"

cd "$REPO_DIR/frontend"
rm -rf node_modules
sudo -u "$HOTPREVUE_USER" env npm_config_cache="$NPM_CACHE" npm ci --prefer-offline
sudo -u "$HOTPREVUE_USER" env npm_config_cache="$NPM_CACHE" npm run build:web
echo "✓ Frontend bygd"

systemctl restart hotprevue
echo "✓ Tjeneste restartet"
