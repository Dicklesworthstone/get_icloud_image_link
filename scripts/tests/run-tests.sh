#!/usr/bin/env bash
# Unit test runner for giil pure functions
# Uses Node.js 18+ native test runner
#
# Note: Each test file extracts functions independently in its before() hook.
# This script is a simple convenience wrapper for local development.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== giil Unit Tests ==="
echo ""

# Verify extraction works (quick sanity check)
echo "[1/2] Verifying function extraction..."
if ! node "$SCRIPT_DIR/extract-functions.mjs" > /dev/null 2>&1; then
    echo "ERROR: Failed to extract functions from giil"
    exit 1
fi
echo "      Extraction OK"

# Run tests (each test file handles its own extraction in before() hook)
echo ""
echo "[2/2] Running unit tests..."
echo ""

node --test "$SCRIPT_DIR"/*.test.mjs

echo ""
echo "Done!"
