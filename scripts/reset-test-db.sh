#!/usr/bin/env bash
# reset-test-db.sh — sletter og gjenskaper hotprevue_test fra bunnen av.
# Kjører alle migrasjoner på nytt. Restarter hotprevue-test.
#
# Bruk: bash scripts/reset-test-db.sh [user@host]
# Standard: kjell@100.121.142.64

set -euo pipefail

REMOTE="${1:-kjell@100.121.142.64}"

RESET=$(cat <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

sudo systemctl stop hotprevue-test

sudo -u postgres dropdb --if-exists hotprevue_test
sudo -u postgres createdb -O hotprevue hotprevue_test
echo "✓ Database gjenskapt"

cd /opt/hotprevue/backend
sudo -u hotprevue env \
  UV_CACHE_DIR=/var/lib/hotprevue/.cache/uv \
  DATABASE_URL="postgresql+psycopg2:///hotprevue_test" \
  /usr/local/bin/uv run alembic upgrade head
echo "✓ Migrasjoner kjørt"

sudo systemctl start hotprevue-test
echo "✓ Test-database resatt: http://$(hostname -I | awk '{print $1}'):8001"
EOF
)

echo "$RESET" | ssh "$REMOTE" "cat > /tmp/hotprevue-reset.sh && chmod +x /tmp/hotprevue-reset.sh"
ssh -t "$REMOTE" "bash /tmp/hotprevue-reset.sh; rm /tmp/hotprevue-reset.sh"
