#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/backend"
HOTPREVUE_SERVER=local HOTPREVUE_OPEN_BROWSER=true \
  "$DIR/uv" run --python 3.12 uvicorn main:app --host 127.0.0.1 --port 8000
