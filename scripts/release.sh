#!/usr/bin/env bash
# release.sh — bump versjon, tag, push og deploy til produksjonsserver.
# Bruk: bash scripts/release.sh patch|minor|major
set -euo pipefail

BUMP="${1:?Bruk: bash scripts/release.sh patch|minor|major}"
REMOTE="kjell@hotprevue"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

case "$BUMP" in
    patch|minor|major) ;;
    *) echo "Feil: ugyldig argument '$BUMP'. Bruk patch, minor eller major."; exit 1 ;;
esac

# ── Beregn ny versjon ─────────────────────────────────────────────────────────

CURRENT=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
    patch) PATCH=$((PATCH + 1)) ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac

NEW_VERSION="v$MAJOR.$MINOR.$PATCH"

echo "→ Versjon: v$CURRENT → $NEW_VERSION"
echo ""

# ── Sjekk at working tree er rent ────────────────────────────────────────────

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Feil: working tree har ucommitede endringer. Commit eller stash før release."
    exit 1
fi

# ── Tester ────────────────────────────────────────────────────────────────────

echo "→ Kjører backend-tester…"
cd "$REPO/backend"
uv run pytest --tb=short -q
echo "✓ Tester bestått"
echo ""

# ── Tag og push ───────────────────────────────────────────────────────────────

cd "$REPO"
git tag "$NEW_VERSION"
git push origin "$NEW_VERSION"
echo "✓ Tag $NEW_VERSION pushet (GitHub Actions bygger release-zip)"
echo ""

# ── Frontend ──────────────────────────────────────────────────────────────────

echo "→ Bygger frontend ($NEW_VERSION)…"
cd "$REPO/frontend"
VITE_APP_VERSION="$NEW_VERSION" npm run build:web
echo "✓ Frontend bygd"
echo ""

# ── Send backend ──────────────────────────────────────────────────────────────

echo "→ Sender backend…"
ssh "$REMOTE" "mkdir -p /opt/hotprevue/backend"
tar -C "$REPO/backend" \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.pytest_cache' \
    --exclude='*.egg-info' \
    -czf - . | ssh "$REMOTE" "tar -C /opt/hotprevue/backend -xzf -"

# ── Send frontend ─────────────────────────────────────────────────────────────

echo "→ Sender frontend…"
ssh "$REMOTE" "rm -rf /opt/hotprevue/frontend/dist && mkdir -p /opt/hotprevue/frontend/dist"
tar -C "$REPO/frontend/dist" -czf - . | \
    ssh "$REMOTE" "tar -C /opt/hotprevue/frontend/dist -xzf -"

# ── Synkroniser og restart ────────────────────────────────────────────────────

echo "→ Synkroniserer avhengigheter, migrerer og restarter…"
ssh "$REMOTE" bash << 'EOF'
set -euo pipefail
cd /opt/hotprevue/backend
uv sync --quiet
DATABASE_URL=postgresql+psycopg2:///hotprevue uv run alembic upgrade head
sudo systemctl restart hotprevue
EOF

echo ""
echo "✓ Produksjon oppdatert til $NEW_VERSION → http://hotprevue:8000"
