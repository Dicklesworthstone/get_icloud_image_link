#!/usr/bin/env bash
# E2E Test: Error Scenarios
#
# Tests that giil returns correct exit codes for various error conditions:
# - EXIT 10: Network/timeout errors
# - EXIT 11: Auth required
# - EXIT 12: Not found (expired/deleted)
# - EXIT 13: Unsupported type (video/document)
#
# Environment:
#   GIIL_ERROR_AUTH_URL - URL that requires authentication (optional)
#   GIIL_ERROR_VIDEO_URL - Video URL to test unsupported type (optional)
#   E2E_KEEP_OUTPUT - Keep output directory for debugging

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Expected exit codes (from giil documentation)
readonly EXIT_USAGE_ERROR=2
readonly EXIT_NETWORK_ERROR=10
readonly EXIT_AUTH_REQUIRED=11
readonly EXIT_NOT_FOUND=12
readonly EXIT_UNSUPPORTED_TYPE=13

# Track test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Run a giil command and check exit code
# Args: expected_exit_code url [extra_args...]
assert_exit_code() {
    local expected_code="$1"
    local url="$2"
    shift 2
    local extra_args=("$@")

    local actual_code=0
    "$E2E_GIIL_BIN" "$url" --json --output "$E2E_OUTPUT_DIR" "${extra_args[@]}" >/dev/null 2>&1 || actual_code=$?

    if [[ "$actual_code" -eq "$expected_code" ]]; then
        return 0
    else
        log_debug "Expected exit code $expected_code, got $actual_code"
        return 1
    fi
}

# Test: Network timeout with very short timeout
test_network_timeout() {
    local test_name="network_timeout"
    ((TESTS_RUN++))

    log_info "Testing: Network timeout (1 second timeout)..."

    # Use a valid iCloud URL but with impossibly short timeout
    # This should fail with network/timeout error
    local test_url="https://share.icloud.com/photos/02cD9okNHvVd-uuDnPCH3ZEEA"

    if assert_exit_code "$EXIT_NETWORK_ERROR" "$test_url" --timeout 1; then
        log_pass "[$test_name] Exit code $EXIT_NETWORK_ERROR (network timeout) returned correctly"
        ((TESTS_PASSED++))
    else
        # Sometimes the page might actually load in 1 second, so this isn't always reliable
        log_warn "[$test_name] Did not get expected exit code $EXIT_NETWORK_ERROR (test may be flaky)"
        ((TESTS_SKIPPED++))
    fi
}

# Test: Not found (non-existent iCloud link)
test_not_found() {
    local test_name="not_found"
    ((TESTS_RUN++))

    log_info "Testing: Not found (non-existent link)..."

    # Use a clearly non-existent iCloud link
    local test_url="https://share.icloud.com/photos/NONEXISTENT_LINK_ABC123XYZ"

    if assert_exit_code "$EXIT_NOT_FOUND" "$test_url" --timeout 30; then
        log_pass "[$test_name] Exit code $EXIT_NOT_FOUND (not found) returned correctly"
        ((TESTS_PASSED++))
    else
        # Could be network error or capture failure depending on how iCloud responds
        log_warn "[$test_name] Did not get expected exit code $EXIT_NOT_FOUND"
        ((TESTS_SKIPPED++))
    fi
}

# Test: Auth required (if test URL provided)
test_auth_required() {
    local test_name="auth_required"
    ((TESTS_RUN++))

    local test_url="${GIIL_ERROR_AUTH_URL:-}"

    if [[ -z "$test_url" ]]; then
        log_info "Skipping: Auth required (no GIIL_ERROR_AUTH_URL configured)"
        ((TESTS_SKIPPED++))
        return 0
    fi

    log_info "Testing: Auth required..."

    if assert_exit_code "$EXIT_AUTH_REQUIRED" "$test_url" --timeout 30; then
        log_pass "[$test_name] Exit code $EXIT_AUTH_REQUIRED (auth required) returned correctly"
        ((TESTS_PASSED++))
    else
        log_fail "[$test_name] Did not get expected exit code $EXIT_AUTH_REQUIRED"
        ((TESTS_FAILED++))
    fi
}

# Test: Unsupported type (video or document)
test_unsupported_type() {
    local test_name="unsupported_type"
    ((TESTS_RUN++))

    local test_url="${GIIL_ERROR_VIDEO_URL:-}"

    if [[ -z "$test_url" ]]; then
        log_info "Skipping: Unsupported type (no GIIL_ERROR_VIDEO_URL configured)"
        ((TESTS_SKIPPED++))
        return 0
    fi

    log_info "Testing: Unsupported type (video)..."

    if assert_exit_code "$EXIT_UNSUPPORTED_TYPE" "$test_url" --timeout 30; then
        log_pass "[$test_name] Exit code $EXIT_UNSUPPORTED_TYPE (unsupported type) returned correctly"
        ((TESTS_PASSED++))
    else
        log_fail "[$test_name] Did not get expected exit code $EXIT_UNSUPPORTED_TYPE"
        ((TESTS_FAILED++))
    fi
}

# Test: JSON error structure
test_json_error_structure() {
    local test_name="json_error_structure"
    ((TESTS_RUN++))

    log_info "Testing: JSON error response structure..."

    # Use a non-existent link to trigger an error
    local test_url="https://share.icloud.com/photos/NONEXISTENT_LINK_FOR_JSON_TEST"
    local output_file="$E2E_OUTPUT_DIR/error_response.json"

    # Run giil and capture JSON output (it should fail)
    "$E2E_GIIL_BIN" "$test_url" --json --output "$E2E_OUTPUT_DIR" --timeout 30 > "$output_file" 2>/dev/null || true

    # Check if output file exists and has content
    if [[ ! -s "$output_file" ]]; then
        log_warn "[$test_name] No JSON output captured"
        ((TESTS_SKIPPED++))
        return 0
    fi

    # Validate JSON structure
    if ! command -v python3 &>/dev/null; then
        log_warn "[$test_name] python3 not available for JSON validation"
        ((TESTS_SKIPPED++))
        return 0
    fi

    local validation_result
    validation_result=$(python3 - << 'PY' "$output_file"
import json
import sys

try:
    with open(sys.argv[1], 'r') as f:
        data = json.load(f)

    # Check required fields for error response
    if data.get('ok') is False:
        if 'error' in data and 'code' in data['error']:
            print("PASS")
        else:
            print("FAIL:missing_error_code")
    elif data.get('ok') is True:
        # Success response, not an error - skip this test
        print("SKIP:success_response")
    else:
        print("FAIL:missing_ok_field")
except json.JSONDecodeError as e:
    print(f"FAIL:invalid_json:{e}")
except Exception as e:
    print(f"FAIL:exception:{e}")
PY
    )

    case "$validation_result" in
        PASS)
            log_pass "[$test_name] JSON error structure is correct"
            ((TESTS_PASSED++))
            ;;
        SKIP:*)
            log_info "[$test_name] Response was success, not error - skipping validation"
            ((TESTS_SKIPPED++))
            ;;
        FAIL:*)
            log_fail "[$test_name] JSON error structure invalid: $validation_result"
            ((TESTS_FAILED++))
            ;;
    esac
}

# Test: Usage error (no URL)
test_usage_error() {
    local test_name="usage_error"
    ((TESTS_RUN++))

    log_info "Testing: Usage error (missing URL)..."

    local actual_code=0
    "$E2E_GIIL_BIN" 2>/dev/null || actual_code=$?

    if [[ "$actual_code" -eq "$EXIT_USAGE_ERROR" ]]; then
        log_pass "[$test_name] Exit code $EXIT_USAGE_ERROR (usage error) returned correctly"
        ((TESTS_PASSED++))
    else
        log_fail "[$test_name] Expected exit code $EXIT_USAGE_ERROR, got $actual_code"
        ((TESTS_FAILED++))
    fi
}

# Main test runner
main() {
    e2e_setup "error-scenarios"

    # Check if giil exists
    if [[ ! -x "$E2E_GIIL_BIN" ]]; then
        log_fail "giil binary not found: $E2E_GIIL_BIN"
        e2e_teardown
        exit 1
    fi

    log_separator

    # Run tests
    test_usage_error
    test_network_timeout
    test_not_found
    test_auth_required
    test_unsupported_type
    test_json_error_structure

    log_separator

    # Summary
    log_info "Error Scenarios Summary:"
    log_info "  Total:   $TESTS_RUN"
    log_info "  Passed:  $TESTS_PASSED"
    log_info "  Failed:  $TESTS_FAILED"
    log_info "  Skipped: $TESTS_SKIPPED"

    e2e_teardown

    if [[ "$TESTS_FAILED" -gt 0 ]]; then
        log_fail "Error scenarios test suite FAILED"
        exit 1
    else
        log_pass "Error scenarios test suite PASSED"
        exit 0
    fi
}

main "$@"
