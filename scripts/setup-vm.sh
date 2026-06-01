#!/bin/bash
# Engangsoppsett av Hotprevue-backend på Ubuntu Server VM.
# Kjøres som root: sudo bash scripts/setup-vm.sh
set -euo pipefail

REPO_DIR="/opt/hotprevue"
DATA_DIR="/var/lib/hotprevue"
HOTPREVUE_USER="hotprevue"
DB_NAME="hotprevue"
DB_USER="hotprevue"

echo "=== Hotprevue VM-oppsett ==="

# ── System-pakker ─────────────────────────────────────────────────────────────

apt-get update -q
apt-get install -y -q curl git postgresql

# Tailscale
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "✓ Tailscale installert"
else
    echo "  Tailscale finnes allerede"
fi

# Node.js 22 via NodeSource
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -q nodejs
fi

# uv
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh
fi

echo "✓ Pakker installert"

# ── Systembruker ──────────────────────────────────────────────────────────────

if ! id "$HOTPREVUE_USER" &>/dev/null; then
    useradd --system --no-create-home --shell /bin/false "$HOTPREVUE_USER"
    echo "✓ Bruker '$HOTPREVUE_USER' opprettet"
fi

# ── PostgreSQL ────────────────────────────────────────────────────────────────

DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

systemctl enable postgresql
systemctl start postgresql

# Opprett DB-bruker hvis den ikke finnes
if ! su -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" postgres | grep -q 1; then
    su -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD'\"" postgres
    echo "✓ PostgreSQL-bruker '$DB_USER' opprettet"
else
    # Oppdater passordet hvis brukeren allerede finnes (idempotent)
    su -c "psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD'\"" postgres
    echo "✓ PostgreSQL-bruker '$DB_USER' eksisterer — passord oppdatert"
fi

if ! su -c "psql -lqt | cut -d\| -f1 | grep -qw $DB_NAME" postgres; then
    su -c "createdb -O $DB_USER $DB_NAME" postgres
    echo "✓ Database '$DB_NAME' opprettet"
fi

# ── Datakatalog ───────────────────────────────────────────────────────────────

mkdir -p "$DATA_DIR/coldpreviews"
chown -R "$HOTPREVUE_USER:$HOTPREVUE_USER" "$DATA_DIR"
echo "✓ Datakatalog: $DATA_DIR"

# ── Repo-tillatelser ──────────────────────────────────────────────────────────

chown -R "$HOTPREVUE_USER:$HOTPREVUE_USER" "$REPO_DIR"

# ── .env ──────────────────────────────────────────────────────────────────────

ENV_FILE="$REPO_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql+psycopg2://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
COLDPREVIEW_DIR=$DATA_DIR/coldpreviews
HOTPREVUE_FRONTEND_DIR=$REPO_DIR/frontend/dist
HOTPREVUE_OPEN_BROWSER=false
EOF
    echo "✓ .env opprettet: $ENV_FILE"
else
    echo "! .env finnes allerede — ikke overskrevet"
    echo "  Husk å sjekke at DATABASE_URL er korrekt"
fi

# ── Python-avhengigheter ──────────────────────────────────────────────────────

cd "$REPO_DIR/backend"
sudo -u "$HOTPREVUE_USER" UV_CACHE_DIR="$DATA_DIR/.cache/uv" /usr/local/bin/uv sync
echo "✓ Python-avhengigheter installert"

# ── Frontend ──────────────────────────────────────────────────────────────────

cd "$REPO_DIR/frontend"
npm ci --silent
npm run build:web
echo "✓ Frontend bygd"

# ── systemd ───────────────────────────────────────────────────────────────────

cp "$REPO_DIR/scripts/hotprevue.service" /etc/systemd/system/hotprevue.service
systemctl daemon-reload
systemctl enable hotprevue
systemctl start hotprevue
echo "✓ systemd-tjeneste aktivert og startet"

# ── Ferdig ────────────────────────────────────────────────────────────────────

echo ""
echo "=== Oppsett fullført ==="
echo "Backend:   http://$(hostname -I | awk '{print $1}'):8000"
echo "Status:    sudo systemctl status hotprevue"
echo "Logger:    sudo journalctl -u hotprevue -f"
echo ""
echo "Koble til Tailscale-nettverket:"
echo "  sudo tailscale up"
