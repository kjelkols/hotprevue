#!/usr/bin/env bash
# Installerer hotprevue-agent som systemd-tjeneste på klientmaskinen.
# Kjøres én gang. Deretter: sudo systemctl restart hotprevue-agent
set -euo pipefail

SERVICE_NAME="hotprevue-agent"
CURRENT_USER="$(whoami)"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# ─── Finn uv ──────────────────────────────────────────────────────────────────

UV_PATH=""
for candidate in \
    "$HOME/.local/bin/uv" \
    "/usr/local/bin/uv" \
    "/usr/bin/uv" \
    "$(which uv 2>/dev/null || true)"; do
    if [[ -x "$candidate" ]]; then
        UV_PATH="$candidate"
        break
    fi
done

if [[ -z "$UV_PATH" ]]; then
    echo "FEIL: finner ikke 'uv'. Installer uv først: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

echo "Bruker uv: $UV_PATH"
echo "Repo:      $REPO_DIR"
echo "Bruker:    $CURRENT_USER"
echo ""

# ─── Skriv service-fil ────────────────────────────────────────────────────────

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Hotprevue lokal agent
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${REPO_DIR}/client
Environment=PATH=${HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=${UV_PATH} run uvicorn agent.main:app --host 127.0.0.1 --port 8002
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ─── Aktiver og start ─────────────────────────────────────────────────────────

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "✓ Tjenesten er installert og startet."
echo ""
echo "  Status:   sudo systemctl status $SERVICE_NAME"
echo "  Logger:   sudo journalctl -u $SERVICE_NAME -f"
echo "  Restart:  sudo systemctl restart $SERVICE_NAME"
