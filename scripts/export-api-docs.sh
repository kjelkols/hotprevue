#!/usr/bin/env bash
# Eksporterer OpenAPI-spec fra kjørende backend til stdout eller fil.
#
# Bruk:
#   ./scripts/export-api-docs.sh                  # skriv til stdout
#   ./scripts/export-api-docs.sh openapi.yaml     # skriv til fil
#   ./scripts/export-api-docs.sh openapi.json     # skriv JSON til fil

set -euo pipefail

HOST="${HOTPREVUE_HOST:-http://localhost:8000}"
OUTPUT="${1:-}"

fetch_json() {
    curl --silent --fail "${HOST}/openapi.json" || {
        echo "Feil: Kunne ikke nå ${HOST}/openapi.json" >&2
        echo "Er backenden kjørende? (docker compose up)" >&2
        exit 1
    }
}

if [[ -z "$OUTPUT" ]]; then
    fetch_json
elif [[ "$OUTPUT" == *.yaml || "$OUTPUT" == *.yml ]]; then
    fetch_json | python3 -c "
import sys, json, yaml
data = json.load(sys.stdin)
print(yaml.dump(data, allow_unicode=True, sort_keys=False))
" > "$OUTPUT"
    echo "Skrevet til $OUTPUT" >&2
else
    fetch_json > "$OUTPUT"
    echo "Skrevet til $OUTPUT" >&2
fi
