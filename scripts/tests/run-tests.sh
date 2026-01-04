#!/usr/bin/env bash
# Unit test runner for giil pure functions
# Uses Node.js 18+ native test runner

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${TMPDIR:-/tmp}"
EXTRACTED_MODULE="$TEMP_DIR/giil-pure-functions.mjs"

echo "=== giil Unit Tests ==="
echo ""

# Step 1: Extract pure functions from giil
echo "[1/3] Extracting pure functions from giil..."
node "$SCRIPT_DIR/extract-functions.mjs" > "$EXTRACTED_MODULE"
echo "      Extracted to: $EXTRACTED_MODULE"

# Step 2: Run tests
echo ""
echo "[2/3] Running unit tests..."
echo ""

# Run all test files
NODE_OPTIONS="--experimental-vm-modules" node --test "$SCRIPT_DIR"/*.test.mjs

echo ""
echo "[3/3] Cleanup..."
rm -f "$EXTRACTED_MODULE"
echo "      Done!"
