#!/usr/bin/env bash
# setup-server.sh — engangsoppsett av produksjonsserver.
# Kjøres som root på serveren:
#   scp scripts/setup-server.sh user@server:~/
#   ssh user@server sudo bash ~/setup-server.sh
set -euo pipefail

DEPLOY_USER="kjell"
DB_NAME="hotprevue"
APP_DIR="/opt/hotprevue"
DATA_DIR="/var/lib/hotprevue"

echo "=== Hotprevue server-oppsett ==="

# ── Pakker ────────────────────────────────────────────────────────────────────

apt-get update -q
apt-get install -y -q postgresql curl

if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh
    echo "✓ uv installert"
else
    echo "  uv finnes allerede"
fi

# ── PostgreSQL ────────────────────────────────────────────────────────────────

systemctl enable postgresql --now

if ! su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DEPLOY_USER'\"" | grep -q 1; then
    su postgres -c "createuser $DEPLOY_USER"
    echo "✓ PostgreSQL-bruker '$DEPLOY_USER' opprettet"
else
    echo "  PostgreSQL-bruker '$DEPLOY_USER' finnes allerede"
fi

if ! su postgres -c "psql -lqt | cut -d'|' -f1 | grep -qw $DB_NAME"; then
    su postgres -c "createdb -O $DEPLOY_USER $DB_NAME"
    echo "✓ Database '$DB_NAME' opprettet"
else
    echo "  Database '$DB_NAME' finnes allerede"
fi

# ── Kataloger ─────────────────────────────────────────────────────────────────

mkdir -p "$APP_DIR/backend" "$APP_DIR/frontend/dist"
mkdir -p "$DATA_DIR/coldpreviews"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR" "$DATA_DIR"
echo "✓ Kataloger opprettet"

# ── .env ──────────────────────────────────────────────────────────────────────

ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << ENVEOF
DATABASE_URL=postgresql+psycopg2:///$DB_NAME
COLDPREVIEW_DIR=$DATA_DIR/coldpreviews
HOTPREVUE_FRONTEND_DIR=$APP_DIR/frontend/dist
HOTPREVUE_OPEN_BROWSER=false
ENVEOF
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
    echo "✓ .env opprettet"
else
    echo "  .env finnes allerede — ikke overskrevet"
fi

# ── systemd ───────────────────────────────────────────────────────────────────

cat > /etc/systemd/system/hotprevue.service << SVCEOF
[Unit]
Description=Hotprevue
After=network.target postgresql.service

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/local/bin/uv run uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable hotprevue
echo "✓ systemd-tjeneste konfigurert"

# ── Sudoers ───────────────────────────────────────────────────────────────────

echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart hotprevue" \
    > /etc/sudoers.d/hotprevue
echo "✓ Sudoers-regel lagt til"

echo ""
echo "=== Oppsett fullført ==="
echo "Kjør nå fra lokal maskin: bash scripts/deploy.sh $DEPLOY_USER@$(hostname -I | awk '{print $1}')"
