#!/usr/bin/env bash
set -euo pipefail

CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
GIIL_HOME="${GIIL_HOME:-$CACHE_HOME/giil}"
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$GIIL_HOME/ms-playwright}"

status=0

log_info() { echo "[check] $*"; }
log_warn() { echo "[warn]  $*"; }
log_err() { echo "[error] $*"; }

log_info "GIIL_HOME=${GIIL_HOME}"
log_info "PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}"

if ! command -v node >/dev/null 2>&1; then
    log_err "node not found in PATH"
    status=1
else
    log_info "node: $(node --version)"
fi

if ! command -v npm >/dev/null 2>&1; then
    log_warn "npm not found in PATH (needed for first-time install)"
else
    log_info "npm: $(npm --version)"
fi

if ! command -v npx >/dev/null 2>&1; then
    log_warn "npx not found in PATH (needed for Playwright install)"
else
    log_info "npx: $(npx --version)"
fi

if [[ -d "${GIIL_HOME}/node_modules/playwright" ]]; then
    log_info "Playwright module found"
else
    log_warn "Playwright module not found at ${GIIL_HOME}/node_modules/playwright"
    log_warn "Run: giil --update  (or run giil once)"
    status=1
fi

if [[ -d "${PLAYWRIGHT_BROWSERS_PATH}" ]]; then
    shopt -s nullglob
    chromium_dirs=("${PLAYWRIGHT_BROWSERS_PATH}"/chromium*)
    shopt -u nullglob

    if (( ${#chromium_dirs[@]} > 0 )); then
        log_info "Chromium browser found: ${chromium_dirs[0]}"
    else
        log_warn "No Chromium browser directory under ${PLAYWRIGHT_BROWSERS_PATH}"
        log_warn "Run: giil --update  (or run giil once)"
        status=1
    fi
else
    log_warn "PLAYWRIGHT_BROWSERS_PATH does not exist"
    log_warn "Run: giil --update  (or run giil once)"
    status=1
fi

if [[ "$status" -eq 0 ]]; then
    log_info "Playwright setup looks good (no downloads performed)"
else
    log_warn "Playwright setup incomplete"
fi

exit "$status"
