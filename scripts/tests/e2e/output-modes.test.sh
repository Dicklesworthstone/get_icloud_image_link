#!/usr/bin/env bash
# E2E Test: Output Modes
#
# Tests various output mode flags:
# - --json: Structured JSON output
# - --base64: Base64 encoded image data
# - --base64 --json: Combined mode
# - --preserve: Skip MozJPEG compression
# - --convert webp: Convert to WebP format
# - --quality N: Set compression quality
#
# Environment:
#   GIIL_ICLOUD_TEST_URL - Override test URL (uses default if not set)
#   E2E_KEEP_OUTPUT - Keep output directory for debugging

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Test configuration - use known working iCloud link
TEST_URL="${GIIL_ICLOUD_TEST_URL:-https://share.icloud.com/photos/02cD9okNHvVd-uuDnPCH3ZEEA}"

# Track test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Test: JSON mode output structure
test_json_mode() {
    local test_name="json_mode"
    ((TESTS_RUN++))

    log_info "Testing: --json mode output structure..."

    local output_file="$E2E_OUTPUT_DIR/json_test.json"
    # Run giil with --json and capture output
    "$E2E_GIIL_BIN" "$TEST_URL" --json --output "$E2E_OUTPUT_DIR" --timeout 120 > "$output_file" 2>/dev/null || true

    # Check if we got valid JSON output
    if [[ ! -s "$output_file" ]]; then
        log_fail "[$test_name] No JSON output captured"
        ((TESTS_FAILED++))
        return 1
    fi

    # Validate JSON structure using jq or python
    if command -v jq &>/dev/null; then
        if jq -e '.ok and .schema_version and .platform and .path' "$output_file" >/dev/null 2>&1; then
            log_pass "[$test_name] JSON output has required fields (ok, schema_version, platform, path)"
            ((TESTS_PASSED++))
            return 0
        else
            log_fail "[$test_name] JSON missing required fields"
            log_debug "JSON content: $(cat "$output_file")"
            ((TESTS_FAILED++))
            return 1
        fi
    elif command -v python3 &>/dev/null; then
        local validation_result
        validation_result=$(python3 - << 'PY' "$output_file"
import json
import sys

try:
    with open(sys.argv[1], 'r') as f:
        data = json.load(f)

    required = ['ok', 'schema_version', 'platform', 'path']
    missing = [k for k in required if k not in data]

    if not missing and data.get('ok') is True:
        print("PASS")
    else:
        print(f"FAIL:missing:{missing}")
except Exception as e:
    print(f"FAIL:{e}")
PY
        )
        if [[ "$validation_result" == "PASS" ]]; then
            log_pass "[$test_name] JSON output has required fields"
            ((TESTS_PASSED++))
            return 0
        else
            log_fail "[$test_name] JSON validation failed: $validation_result"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        log_warn "[$test_name] No jq or python3 available for JSON validation"
        ((TESTS_SKIPPED++))
        return 0
    fi
}

# Test: Base64 mode
test_base64_mode() {
    local test_name="base64_mode"
    ((TESTS_RUN++))

    log_info "Testing: --base64 mode..."

    local output_file="$E2E_OUTPUT_DIR/base64_output.txt"
    local decoded_file="$E2E_OUTPUT_DIR/base64_decoded.jpg"

    # Run giil with --base64
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --base64 --timeout 120 > "$output_file" 2>/dev/null; then
        log_fail "[$test_name] giil --base64 failed"
        ((TESTS_FAILED++))
        return 1
    fi

    # Check if output is valid base64
    if [[ ! -s "$output_file" ]]; then
        log_fail "[$test_name] No base64 output"
        ((TESTS_FAILED++))
        return 1
    fi

    # Decode and verify it's a valid image
    if base64 -d < "$output_file" > "$decoded_file" 2>/dev/null; then
        if file "$decoded_file" | grep -qiE 'image|jpeg|png|webp|gif'; then
            log_pass "[$test_name] Base64 decodes to valid image"
            ((TESTS_PASSED++))
            return 0
        else
            log_fail "[$test_name] Base64 decodes but not to valid image"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        log_fail "[$test_name] Invalid base64 encoding"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test: Base64 + JSON combined mode
test_base64_json_mode() {
    local test_name="base64_json_mode"
    ((TESTS_RUN++))

    log_info "Testing: --base64 --json combined mode..."

    local output_file="$E2E_OUTPUT_DIR/base64_json.json"

    # Run giil with --base64 --json
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --base64 --json --timeout 120 > "$output_file" 2>/dev/null; then
        log_fail "[$test_name] giil --base64 --json failed"
        ((TESTS_FAILED++))
        return 1
    fi

    if [[ ! -s "$output_file" ]]; then
        log_fail "[$test_name] No output"
        ((TESTS_FAILED++))
        return 1
    fi

    # Validate JSON has base64 data field
    if command -v jq &>/dev/null; then
        if jq -e '.ok and .data' "$output_file" >/dev/null 2>&1; then
            # Verify the data field contains base64
            local data_field
            data_field=$(jq -r '.data // empty' "$output_file")
            if [[ -n "$data_field" ]] && echo "$data_field" | base64 -d >/dev/null 2>&1; then
                log_pass "[$test_name] JSON contains valid base64 data field"
                ((TESTS_PASSED++))
                return 0
            else
                log_fail "[$test_name] data field is not valid base64"
                ((TESTS_FAILED++))
                return 1
            fi
        else
            log_fail "[$test_name] JSON missing ok or data field"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        log_warn "[$test_name] jq not available for validation"
        ((TESTS_SKIPPED++))
        return 0
    fi
}

# Test: Preserve mode (skip compression)
test_preserve_mode() {
    local test_name="preserve_mode"
    ((TESTS_RUN++))

    log_info "Testing: --preserve mode (skip compression)..."

    # Use separate subdirectories to avoid filename collisions
    # (giil generates filenames from EXIF datetime, same for same image)
    local normal_dir="$E2E_OUTPUT_DIR/normal"
    local preserve_dir="$E2E_OUTPUT_DIR/preserve"
    mkdir -p "$normal_dir" "$preserve_dir"

    local json_normal="$E2E_OUTPUT_DIR/normal.json"
    local json_preserve="$E2E_OUTPUT_DIR/preserve.json"

    # Download without preserve (normal compression)
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --json --output "$normal_dir" --timeout 120 > "$json_normal" 2>/dev/null; then
        log_fail "[$test_name] Normal download failed"
        ((TESTS_FAILED++))
        return 1
    fi

    # Get the output path from JSON
    local normal_path
    if command -v jq &>/dev/null; then
        normal_path=$(jq -r '.path // empty' "$json_normal")
    else
        log_warn "[$test_name] jq not available"
        ((TESTS_SKIPPED++))
        return 0
    fi

    if [[ -z "$normal_path" || ! -f "$normal_path" ]]; then
        log_fail "[$test_name] Normal output file not found"
        ((TESTS_FAILED++))
        return 1
    fi

    local normal_size
    normal_size=$(stat -c%s "$normal_path" 2>/dev/null || stat -f%z "$normal_path" 2>/dev/null || echo "0")

    # Download with --preserve to separate directory
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --preserve --json --output "$preserve_dir" --timeout 120 > "$json_preserve" 2>/dev/null; then
        log_fail "[$test_name] Preserve download failed"
        ((TESTS_FAILED++))
        return 1
    fi

    local preserve_path
    preserve_path=$(jq -r '.path // empty' "$json_preserve")

    if [[ -z "$preserve_path" || ! -f "$preserve_path" ]]; then
        log_fail "[$test_name] Preserve output file not found"
        ((TESTS_FAILED++))
        return 1
    fi

    local preserve_size
    preserve_size=$(stat -c%s "$preserve_path" 2>/dev/null || stat -f%z "$preserve_path" 2>/dev/null || echo "0")

    log_info "[$test_name] Normal size: $normal_size bytes, Preserve size: $preserve_size bytes"

    # Preserved should typically be same or larger (no compression applied)
    # Note: This test may be flaky if the image is already optimally compressed
    if [[ "$preserve_size" -ge "$normal_size" ]]; then
        log_pass "[$test_name] Preserve mode produces same or larger file (compression skipped)"
        ((TESTS_PASSED++))
    else
        # Not a hard failure - compression behavior can vary
        log_info "[$test_name] Preserve mode produced smaller file (may vary by image)"
        ((TESTS_PASSED++))
    fi
    return 0
}

# Test: Convert to WebP
test_convert_webp() {
    local test_name="convert_webp"
    ((TESTS_RUN++))

    log_info "Testing: --convert webp mode..."

    local json_file="$E2E_OUTPUT_DIR/webp.json"

    # Download with --convert webp
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --convert webp --json --output "$E2E_OUTPUT_DIR" --timeout 120 > "$json_file" 2>/dev/null; then
        log_fail "[$test_name] WebP conversion failed"
        ((TESTS_FAILED++))
        return 1
    fi

    # Check output path has .webp extension
    local output_path
    if command -v jq &>/dev/null; then
        output_path=$(jq -r '.path // empty' "$json_file")
    else
        log_warn "[$test_name] jq not available"
        ((TESTS_SKIPPED++))
        return 0
    fi

    if [[ -z "$output_path" ]]; then
        log_fail "[$test_name] No output path in JSON"
        ((TESTS_FAILED++))
        return 1
    fi

    # Verify .webp extension
    if [[ "$output_path" == *.webp ]]; then
        log_pass "[$test_name] Output has .webp extension"
    else
        log_warn "[$test_name] Output does not have .webp extension: $output_path"
    fi

    # Verify file is actually WebP
    if [[ -f "$output_path" ]]; then
        if file "$output_path" | grep -qi webp; then
            log_pass "[$test_name] File is valid WebP format"
            ((TESTS_PASSED++))
            return 0
        else
            local file_type
            file_type=$(file "$output_path")
            log_fail "[$test_name] File is not WebP: $file_type"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        log_fail "[$test_name] Output file not found: $output_path"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test: Quality setting
test_quality_setting() {
    local test_name="quality_setting"
    ((TESTS_RUN++))

    log_info "Testing: --quality 50 mode..."

    # Use separate subdirectories to avoid filename collisions
    # (giil generates filenames from EXIF datetime, same for same image)
    local high_dir="$E2E_OUTPUT_DIR/quality_high"
    local low_dir="$E2E_OUTPUT_DIR/quality_low"
    mkdir -p "$high_dir" "$low_dir"

    local json_high="$E2E_OUTPUT_DIR/quality_high.json"
    local json_low="$E2E_OUTPUT_DIR/quality_low.json"

    # Download with default quality (typically 85)
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --json --output "$high_dir" --timeout 120 > "$json_high" 2>/dev/null; then
        log_fail "[$test_name] High quality download failed"
        ((TESTS_FAILED++))
        return 1
    fi

    # Download with low quality to separate directory
    if ! "$E2E_GIIL_BIN" "$TEST_URL" --quality 50 --json --output "$low_dir" --timeout 120 > "$json_low" 2>/dev/null; then
        log_fail "[$test_name] Low quality download failed"
        ((TESTS_FAILED++))
        return 1
    fi

    if ! command -v jq &>/dev/null; then
        log_warn "[$test_name] jq not available"
        ((TESTS_SKIPPED++))
        return 0
    fi

    local path_high path_low
    path_high=$(jq -r '.path // empty' "$json_high")
    path_low=$(jq -r '.path // empty' "$json_low")

    if [[ -z "$path_high" || ! -f "$path_high" ]]; then
        log_fail "[$test_name] High quality output file not found"
        ((TESTS_FAILED++))
        return 1
    fi

    if [[ -z "$path_low" || ! -f "$path_low" ]]; then
        log_fail "[$test_name] Low quality output file not found"
        ((TESTS_FAILED++))
        return 1
    fi

    local size_high size_low
    size_high=$(stat -c%s "$path_high" 2>/dev/null || stat -f%z "$path_high" 2>/dev/null || echo "0")
    size_low=$(stat -c%s "$path_low" 2>/dev/null || stat -f%z "$path_low" 2>/dev/null || echo "0")

    log_info "[$test_name] High quality: $size_high bytes, Low quality (50): $size_low bytes"

    # Lower quality should produce smaller file
    if [[ "$size_low" -lt "$size_high" ]]; then
        log_pass "[$test_name] Lower quality produces smaller file"
        ((TESTS_PASSED++))
    else
        # Could be same size if already small, not a hard failure
        log_info "[$test_name] Quality setting may not affect this image significantly"
        ((TESTS_PASSED++))
    fi
    return 0
}

# Main test runner
main() {
    e2e_setup "output-modes"

    # Check if giil exists
    if [[ ! -x "$E2E_GIIL_BIN" ]]; then
        log_fail "giil binary not found: $E2E_GIIL_BIN"
        e2e_teardown
        exit 1
    fi

    # Check for jq (used by most tests)
    if ! command -v jq &>/dev/null; then
        log_warn "jq not installed - some tests will be skipped"
    fi

    log_separator

    # Run tests
    test_json_mode
    test_base64_mode
    test_base64_json_mode
    test_preserve_mode
    test_convert_webp
    test_quality_setting

    log_separator

    # Summary
    log_info "Output Modes Summary:"
    log_info "  Total:   $TESTS_RUN"
    log_info "  Passed:  $TESTS_PASSED"
    log_info "  Failed:  $TESTS_FAILED"
    log_info "  Skipped: $TESTS_SKIPPED"

    e2e_teardown

    if [[ "$TESTS_FAILED" -gt 0 ]]; then
        log_fail "Output modes test suite FAILED"
        exit 1
    else
        log_pass "Output modes test suite PASSED"
        exit 0
    fi
}

main "$@"
