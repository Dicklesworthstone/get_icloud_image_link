#!/usr/bin/env bash
set -euo pipefail

LINK="https://share.icloud.com/photos/02cD9okNHvVd-uuDnPCH3ZEEA"
EXPECTED_SHA_FILE="scripts/real_icloud_expected.sha256"

if [[ ! -f "$EXPECTED_SHA_FILE" ]]; then
    echo "[error] Missing expected SHA file: $EXPECTED_SHA_FILE" >&2
    exit 1
fi

EXPECTED_SHA=$(tr -d '[:space:]' < "$EXPECTED_SHA_FILE")
if [[ -z "$EXPECTED_SHA" ]]; then
    echo "[error] Expected SHA file is empty" >&2
    exit 1
fi

CACHE_ROOT="${GIIL_HOME:-$PWD/.ci-cache/giil}"
OUTPUT_DIR="$PWD/.ci-output"
OUTPUT_JSON="$OUTPUT_DIR/output.json"

mkdir -p "$OUTPUT_DIR"

export GIIL_HOME="$CACHE_ROOT"
export PLAYWRIGHT_BROWSERS_PATH="$GIIL_HOME/ms-playwright"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$PWD/.ci-cache}"

./giil "$LINK" --json --output "$OUTPUT_DIR" --timeout 120 > "$OUTPUT_JSON"

read -r OUTPUT_PATH METHOD < <(python - << 'PY' "$OUTPUT_JSON"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data.get('path', ''))
print(data.get('method', ''))
PY
)

if [[ -z "$OUTPUT_PATH" || ! -f "$OUTPUT_PATH" ]]; then
    echo "[error] Output file missing: $OUTPUT_PATH" >&2
    exit 1
fi

if [[ -z "$METHOD" ]]; then
    echo "[error] Missing capture method in JSON output" >&2
    exit 1
fi

ACTUAL_SHA=$(sha256sum "$OUTPUT_PATH" | awk '{print $1}')

if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
    echo "[error] SHA mismatch" >&2
    echo "expected: $EXPECTED_SHA" >&2
    echo "actual:   $ACTUAL_SHA" >&2
    exit 1
fi

echo "[ok] Real-link download SHA matches expected ($ACTUAL_SHA)"
