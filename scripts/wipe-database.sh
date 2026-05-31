#!/usr/bin/env bash
# wipe-database.sh — tømmer alle tabeller i hotprevue-databasen på VM-en.
# Beholder skjema og migrasjonshistorikk. Restarter tjenesten etterpå.
#
# Bruk: ./scripts/wipe-database.sh [VM_HOST]
# Standard VM_HOST: 100.121.142.64

set -euo pipefail

VM_HOST="${1:-100.121.142.64}"
VM_USER="kjell"
ENV_FILE="/opt/hotprevue/backend/.env"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ADVARSEL: DETTE SLETTER ALL DATA I HOTPREVUE-DATABASEN  ║"
echo "║                                                          ║"
echo "║  Alle bilder, fotografer, samlinger, hendelser,         ║"
echo "║  maskiner og innstillinger blir permanent slettet.      ║"
echo "║                                                          ║"
echo "║  VM: $VM_HOST"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
read -r -p "Skriv SLETT for å bekrefte: " CONFIRM

if [[ "$CONFIRM" != "SLETT" ]]; then
    echo "Avbrutt."
    exit 0
fi

echo ""
echo "→ Tømmer alle tabeller..."
ssh "${VM_USER}@${VM_HOST}" bash <<'ENDSSH'
set -euo pipefail
DB=$(grep ^DATABASE_URL /opt/hotprevue/backend/.env | cut -d= -f2- | sed 's|postgresql+psycopg2://|postgresql://|')
psql "$DB" -c "DO \$\$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'alembic_version') LOOP EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END \$\$;"
echo "→ Restarter tjeneste..."
sudo -n systemctl restart hotprevue
ENDSSH

echo "✓ Database tømt og tjeneste restartet."
echo ""
