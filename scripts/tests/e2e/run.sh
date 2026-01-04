#!/usr/bin/env bash
# E2E Test Runner for giil
#
# Runs all E2E tests and reports results.
#
# Usage:
#   ./run.sh              # Run all E2E tests
#   ./run.sh icloud       # Run only iCloud test
#   ./run.sh --list       # List available tests
#
# Environment:
#   E2E_KEEP_OUTPUT=1     # Keep output directories for debugging
#   GIIL_LOG_FORMAT=json  # Force JSON output (auto in CI)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=../lib/log.sh
source "$TESTS_ROOT/lib/log.sh"

# Track results
passed=0
failed=0
skipped=0
start_time=$SECONDS

# List available tests
list_tests() {
    echo "Available E2E tests:"
    for test in "$SCRIPT_DIR"/*.test.sh; do
        if [[ -f "$test" ]]; then
            echo "  - $(basename "$test" .test.sh)"
        fi
    done
}

# Run a single test
run_test() {
    local test_file="$1"
    local test_name
    test_name=$(basename "$test_file" .test.sh)

    log_info "Running E2E test: $test_name"

    local test_start=$SECONDS
    local exit_code=0

    if bash "$test_file"; then
        exit_code=0
    else
        exit_code=$?
    fi

    local duration=$((SECONDS - test_start))

    case $exit_code in
        0)
            log_test_result "$test_name" "pass" "$((duration * 1000))"
            ((++passed))
            ;;
        77)
            # Exit code 77 is standard "skipped" (used by autotools, bats, etc.)
            log_test_result "$test_name" "skip" "$((duration * 1000))"
            ((++skipped))
            ;;
        *)
            log_test_result "$test_name" "fail" "$((duration * 1000))"
            ((++failed))
            ;;
    esac
}

# Main
main() {
    local filter="${1:-}"

    if [[ "$filter" == "--list" ]]; then
        list_tests
        exit 0
    fi

    log_section "E2E Integration Tests"

    local tests_to_run=()

    if [[ -n "$filter" ]]; then
        # Run specific test
        local test_file="$SCRIPT_DIR/${filter}.test.sh"
        if [[ -f "$test_file" ]]; then
            tests_to_run+=("$test_file")
        else
            log_fail "Test not found: $filter"
            log_info "Use --list to see available tests"
            exit 1
        fi
    else
        # Run all tests
        for test in "$SCRIPT_DIR"/*.test.sh; do
            if [[ -f "$test" ]]; then
                tests_to_run+=("$test")
            fi
        done
    fi

    if [[ ${#tests_to_run[@]} -eq 0 ]]; then
        log_warn "No E2E tests found"
        exit 0
    fi

    log_info "Found ${#tests_to_run[@]} E2E test(s)"
    log_separator

    for test in "${tests_to_run[@]}"; do
        run_test "$test"
    done

    local duration=$((SECONDS - start_time))
    log_separator
    log_suite_summary "E2E Tests" "$passed" "$failed" "$skipped" "$((duration * 1000))"

    exit $((failed > 0 ? 1 : 0))
}

main "$@"
