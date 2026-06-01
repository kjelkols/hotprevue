#!/usr/bin/env bash
# install-test-service.sh — engangsoppsett av hotprevue-test på serveren.
#
# Bruk: bash scripts/install-test-service.sh [user@host]
# Standard: kjell@100.121.142.64

set -euo pipefail

REMOTE="${1:-kjell@100.121.142.64}"
REPO_DIR="$(dirname "$0")/.."

echo "→ Kopierer filer til serveren…"
scp "$REPO_DIR/scripts/hotprevue-test.service" "$REMOTE:/tmp/hotprevue-test.service"

SETUP=$(cat <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# .env.test — bruker Unix socket (ingen passord, peer-auth via OS-bruker hotprevue)
if [ ! -f /opt/hotprevue/backend/.env.test ]; then
  printf 'DATABASE_URL=postgresql+psycopg2:///hotprevue_test\nCOLDPREVIEW_DIR=/data/coldpreviews\n' \
    | sudo tee /opt/hotprevue/backend/.env.test > /dev/null
  echo "✓ .env.test opprettet"
else
  echo "  .env.test finnes allerede, hopper over"
fi

# PostgreSQL-database
if sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw hotprevue_test; then
  echo "  database hotprevue_test finnes allerede, hopper over"
else
  sudo -u postgres createdb -O hotprevue hotprevue_test
  echo "✓ Database hotprevue_test opprettet"
fi

# Migrasjoner via Unix socket (peer-auth, ingen passord)
cd /opt/hotprevue/backend
sudo -u hotprevue env \
  UV_CACHE_DIR=/var/lib/hotprevue/.cache/uv \
  DATABASE_URL="postgresql+psycopg2:///hotprevue_test" \
  /usr/local/bin/uv run alembic upgrade head
echo "✓ Migrasjoner kjørt"

# Systemd-tjeneste
sudo mv /tmp/hotprevue-test.service /etc/systemd/system/hotprevue-test.service
sudo systemctl daemon-reload
sudo systemctl enable hotprevue-test
sudo systemctl start hotprevue-test
echo "✓ hotprevue-test startet på port 8001"

# Sudoers-regel for reset-scriptet
if [ -f /etc/sudoers.d/hotprevue-test ] && sudo grep -q "hotprevue-test" /etc/sudoers.d/hotprevue-test 2>/dev/null; then
  echo "  sudoers-regel finnes allerede, hopper over"
else
  printf 'kjell ALL=(ALL) NOPASSWD: /bin/systemctl stop hotprevue-test, /bin/systemctl start hotprevue-test, /bin/systemctl restart hotprevue-test\n' \
    | sudo tee /etc/sudoers.d/hotprevue-test > /dev/null
  echo "✓ Sudoers-regel lagt til"
fi

echo ""
echo "✓ Test-instans klar: http://$(hostname -I | awk '{print $1}'):8001"
EOF
)

echo "$SETUP" | ssh "$REMOTE" "cat > /tmp/hotprevue-setup.sh && chmod +x /tmp/hotprevue-setup.sh"
echo "→ Kjører oppsett på serveren (sudo krever passord)…"
ssh -t "$REMOTE" "bash /tmp/hotprevue-setup.sh; rm /tmp/hotprevue-setup.sh"
