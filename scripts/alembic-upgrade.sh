#!/usr/bin/env bash
# alembic-upgrade.sh — kjør Alembic-migrasjoner mot lokal database.
# Bruk: bash scripts/alembic-upgrade.sh

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${HOTPREVUE_DATA_DIR:-$HOME/.local/share/hotprevue}"
DB_NAME="$(basename "$DATA_DIR")"
DATABASE_URL="postgresql+psycopg2:///$DB_NAME"

cd "$REPO/backend" && DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
