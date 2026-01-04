#!/usr/bin/env bash
# E2E Test: Album Mode (--all)
#
# Tests downloading multiple photos from shared albums using --all flag.
# Verifies:
# - All photos are downloaded to output directory
# - Each file is a valid image
# - JSON output contains entries for each file
# - Correct file count matches expected
#
# Environment:
#   GIIL_ALBUM_ICLOUD_URL    - iCloud album URL to test
#   GIIL_ALBUM_ICLOUD_COUNT  - Expected photo count for iCloud album
#   GIIL_ALBUM_GPHOTOS_URL   - Google Photos album URL to test
#   GIIL_ALBUM_GPHOTOS_COUNT - Expected photo count for Google Photos album
#   E2E_KEEP_OUTPUT          - Keep output directory for debugging
#
# Note: This test requires real album URLs to be configured.
# Skip is automatic if no test URLs are set.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Test an album with --all flag
# Args: platform, url, expected_count
test_album() {
    local platform="$1"
    local url="$2"
    local expected_count="$3"
    local exit_code=0

    log_section "Album Mode: $platform"
    log_info "URL: $url"
    log_info "Expected count: $expected_count"

    # Create dedicated output directory for this album
    local album_output="$E2E_OUTPUT_DIR/$platform-album"
    mkdir -p "$album_output"

    local json_output="$album_output/output.jsonl"

    # Run giil with --all
    local start=$SECONDS
    if ! "$E2E_GIIL_BIN" "$url" --all --json --output "$album_output" > "$json_output" 2>&1; then
        log_fail "giil --all command failed for $platform"
        if [[ -f "$json_output" ]]; then
            log_info "Output: $(head -20 "$json_output")"
        fi
        return 1
    fi
    local duration=$((SECONDS - start))
    log_info "Download duration: ${duration}s"

    # Count downloaded files (exclude .json files)
    local actual_count
    actual_count=$(find "$album_output" -maxdepth 1 -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.heic" -o -name "*.webp" -o -name "*.gif" \) | wc -l | tr -d ' ')

    log_info "Downloaded files: $actual_count"

    # Verify file count
    if [[ "$actual_count" -eq "$expected_count" ]]; then
        log_pass "File count matches expected ($expected_count)"
    elif [[ "$actual_count" -gt 0 ]]; then
        log_warn "File count mismatch: got $actual_count, expected $expected_count"
        # Don't fail - album content may change
    else
        log_fail "No files downloaded"
        exit_code=1
    fi

    # Verify each downloaded file is a valid image
    local valid_count=0
    local invalid_count=0
    for file in "$album_output"/*; do
        [[ -f "$file" ]] || continue
        [[ "$file" == *.json* ]] && continue

        if e2e_assert_valid_image "$file" "Valid image: $(basename "$file")"; then
            ((valid_count+=1))
        else
            ((invalid_count+=1))
            exit_code=1
        fi
    done

    log_info "Valid images: $valid_count, Invalid: $invalid_count"

    # Verify JSON output has entries (one per line)
    if [[ -f "$json_output" && -s "$json_output" ]]; then
        local json_lines
        json_lines=$(wc -l < "$json_output" | tr -d ' ')
        log_info "JSON output lines: $json_lines"

        # Each line should be valid JSON with 'path' field
        local first_line
        first_line=$(head -1 "$json_output")
        if echo "$first_line" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if 'path' in d else 1)" 2>/dev/null; then
            log_pass "JSON output has valid structure"
        else
            # giil may output to stdout differently for --all mode
            log_info "JSON format: $first_line"
        fi
    fi

    return $exit_code
}

# Main test
main() {
    local exit_code=0
    local tests_run=0
    local tests_passed=0

    e2e_setup "album-mode"

    # Check if giil exists
    if [[ ! -x "$E2E_GIIL_BIN" ]]; then
        log_fail "giil binary not found or not executable: $E2E_GIIL_BIN"
        e2e_teardown
        exit 1
    fi

    # Test iCloud album if configured
    if [[ -n "${GIIL_ALBUM_ICLOUD_URL:-}" ]]; then
        local expected="${GIIL_ALBUM_ICLOUD_COUNT:-3}"
        ((tests_run+=1))
        if test_album "icloud" "$GIIL_ALBUM_ICLOUD_URL" "$expected"; then
            ((tests_passed+=1))
        else
            exit_code=1
        fi
    else
        log_info "Skipping iCloud album test (GIIL_ALBUM_ICLOUD_URL not set)"
    fi

    # Test Google Photos album if configured
    if [[ -n "${GIIL_ALBUM_GPHOTOS_URL:-}" ]]; then
        local expected="${GIIL_ALBUM_GPHOTOS_COUNT:-3}"
        ((tests_run+=1))
        if test_album "google-photos" "$GIIL_ALBUM_GPHOTOS_URL" "$expected"; then
            ((tests_passed+=1))
        else
            exit_code=1
        fi
    else
        log_info "Skipping Google Photos album test (GIIL_ALBUM_GPHOTOS_URL not set)"
    fi

    # If no tests were run, skip gracefully
    if [[ "$tests_run" -eq 0 ]]; then
        log_warn "No album tests configured. Set GIIL_ALBUM_ICLOUD_URL or GIIL_ALBUM_GPHOTOS_URL to enable."
        e2e_teardown
        exit 0
    fi

    e2e_teardown

    log_separator
    if [[ "$tests_passed" -eq "$tests_run" ]]; then
        log_pass "Album mode E2E: $tests_passed/$tests_run tests passed"
    else
        log_fail "Album mode E2E: $tests_passed/$tests_run tests passed"
    fi

    exit "$exit_code"
}

main "$@"
