#!/usr/bin/env bash
# deploy-worker.sh — sync worker/ til tenketank og start tjenesten på nytt.
# Bruk: bash scripts/deploy-worker.sh

set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="kjell@tenketank.tail764ab5.ts.net"
REMOTE_DIR="/opt/hotprevue/worker"
VENV="/opt/tenketank/venv/bin/pip"

echo "→ Syncer worker/ til tenketank..."
rsync -av "$REPO/worker/" "$REMOTE:$REMOTE_DIR/"

echo "→ Installerer avhengigheter..."
ssh "$REMOTE" "$VENV install -q -r $REMOTE_DIR/requirements.txt"

echo "→ Starter tjenesten på nytt..."
ssh "$REMOTE" "sudo systemctl restart hotprevue-worker"

echo "→ Status:"
ssh "$REMOTE" "sudo systemctl status hotprevue-worker --no-pager -l"
