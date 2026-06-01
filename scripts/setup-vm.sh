#!/bin/bash
# Engangsoppsett av Hotprevue på Ubuntu Server VM.
# Kjøres som root: sudo bash scripts/setup-vm.sh
set -euo pipefail

REPO_DIR="/opt/hotprevue"
DATA_DIR="/var/lib/hotprevue"
DEPLOY_USER="kjell"
DB_NAME="hotprevue"

echo "=== Hotprevue VM-oppsett ==="

# ── Tailscale ─────────────────────────────────────────────────────────────────

if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "✓ Tailscale installert"
else
    echo "  Tailscale finnes allerede"
fi

# ── System-pakker ─────────────────────────────────────────────────────────────

apt-get update -q
apt-get install -y -q curl git postgresql

if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -q nodejs
fi

if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh
fi

echo "✓ Pakker installert"

# ── PostgreSQL ────────────────────────────────────────────────────────────────

systemctl enable postgresql
systemctl start postgresql

if ! su -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DEPLOY_USER'\"" postgres | grep -q 1; then
    su -c "createuser $DEPLOY_USER" postgres
    echo "✓ PostgreSQL-bruker '$DEPLOY_USER' opprettet"
else
    echo "  PostgreSQL-bruker '$DEPLOY_USER' finnes allerede"
fi

if ! su -c "psql -lqt | cut -d\| -f1 | grep -qw $DB_NAME" postgres; then
    su -c "createdb -O $DEPLOY_USER $DB_NAME" postgres
    echo "✓ Database '$DB_NAME' opprettet"
else
    echo "  Database '$DB_NAME' finnes allerede"
fi

# ── Datakatalog ───────────────────────────────────────────────────────────────

mkdir -p "$DATA_DIR/coldpreviews"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DATA_DIR"
echo "✓ Datakatalog: $DATA_DIR"

# ── Eierskap og git-konfig ────────────────────────────────────────────────────

git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR"

# ── .env ──────────────────────────────────────────────────────────────────────

ENV_FILE="$REPO_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql+psycopg2:///$DB_NAME
COLDPREVIEW_DIR=$DATA_DIR/coldpreviews
HOTPREVUE_FRONTEND_DIR=$REPO_DIR/frontend/dist
HOTPREVUE_OPEN_BROWSER=false
EOF
    echo "✓ .env opprettet"
else
    echo "  .env finnes allerede — ikke overskrevet"
fi

# ── Python-avhengigheter ──────────────────────────────────────────────────────

cd "$REPO_DIR/backend"
sudo -u "$DEPLOY_USER" uv sync
echo "✓ Python-avhengigheter installert"

# ── Frontend ──────────────────────────────────────────────────────────────────

cd "$REPO_DIR/frontend"
npm ci --silent
npm run build:web
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR/frontend"
echo "✓ Frontend bygd"

# ── systemd ───────────────────────────────────────────────────────────────────

cp "$REPO_DIR/scripts/hotprevue.service" /etc/systemd/system/hotprevue.service
systemctl daemon-reload
systemctl enable hotprevue
systemctl start hotprevue
echo "✓ systemd-tjeneste aktivert og startet"

# ── Sudoers ───────────────────────────────────────────────────────────────────

echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart hotprevue" \
    > /etc/sudoers.d/hotprevue
echo "✓ Sudoers-regel lagt til"

# ── Ferdig ────────────────────────────────────────────────────────────────────

echo ""
echo "=== Oppsett fullført ==="
echo "Backend:   http://$(hostname -I | awk '{print $1}'):8000"
echo "Status:    sudo systemctl status hotprevue"
echo "Logger:    sudo journalctl -u hotprevue -f"
echo ""
echo "Koble til Tailscale:"
echo "  sudo tailscale up"
