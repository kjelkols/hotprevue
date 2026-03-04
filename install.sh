#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/backend"
"$DIR/uv" run --python 3.12 python installer.py --root "$DIR"
