#!/usr/bin/env bash
# run-tests.sh — kjør backend-tester mot lokal PostgreSQL.
# Bruk: bash scripts/run-tests.sh [pytest-args]

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${HOTPREVUE_DATA_DIR:-$HOME/.local/share/hotprevue}"
DB_NAME="$(basename "$DATA_DIR")"
DB_URL="postgresql+psycopg2:///$DB_NAME?host=/run/postgresql"
TEST_DB_URL="postgresql+psycopg2:///${DB_NAME}_test?host=/run/postgresql"

cd "$REPO/backend" && \
  DATABASE_URL="$TEST_DB_URL" \
  TEST_DATABASE_URL="$TEST_DB_URL" \
  uv run pytest "${@:-tests/ -v}"
