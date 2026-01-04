/**
 * Unit tests for JSON formatting functions
 * Tests the v3 JSON schema output helpers: formatJsonSuccess, formatJsonError
 * Also tests errorCodeToExit mapping
 */

import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wrap all tests in a parent describe to ensure before() completes first
describe('JSON Formatting Tests', () => {
    let formatJsonSuccess;
    let formatJsonError;
    let errorCodeToExit;
    let setCurrentPlatform;
    let ExitCodes;
    let tempModule;

    before(async () => {
        const extractorPath = join(__dirname, 'extract-functions.mjs');
        const projectRoot = join(__dirname, "../..");
        tempModule = join(projectRoot, `giil-test-json-formatting-${process.pid}.mjs`);

        const extracted = execSync(`node "${extractorPath}"`, { encoding: 'utf8' });
        writeFileSync(tempModule, extracted);

        const mod = await import(tempModule);
        formatJsonSuccess = mod.formatJsonSuccess;
        formatJsonError = mod.formatJsonError;
        errorCodeToExit = mod.errorCodeToExit;
        setCurrentPlatform = mod.setCurrentPlatform;
        ExitCodes = mod.ExitCodes;
    });

    after(() => {
        if (tempModule && existsSync(tempModule)) {
            try { unlinkSync(tempModule); } catch {}
        }
    });

    describe('formatJsonSuccess', () => {
    beforeEach(() => {
        // Reset platform before each test
        setCurrentPlatform('icloud');
    });

    it('returns object with schema_version "1"', () => {
        const result = formatJsonSuccess({});
        assert.strictEqual(result.schema_version, '1');
    });

    it('returns object with ok: true', () => {
        const result = formatJsonSuccess({});
        assert.strictEqual(result.ok, true);
    });

    it('includes current platform', () => {
        setCurrentPlatform('dropbox');
        const result = formatJsonSuccess({});
        assert.strictEqual(result.platform, 'dropbox');
    });

    it('merges provided data into result', () => {
        const result = formatJsonSuccess({
            path: '/tmp/test.jpg',
            method: 'download-button'
        });
        assert.strictEqual(result.path, '/tmp/test.jpg');
        assert.strictEqual(result.method, 'download-button');
    });

    it('preserves all data properties', () => {
        const data = {
            path: '/path/to/image.jpg',
            datetime: '2024-01-01T12:00:00Z',
            sourceUrl: 'https://example.com/img.jpg',
            method: 'network',
            width: 1920,
            height: 1080,
            size: 123456
        };
        const result = formatJsonSuccess(data);

        assert.strictEqual(result.path, data.path);
        assert.strictEqual(result.datetime, data.datetime);
        assert.strictEqual(result.sourceUrl, data.sourceUrl);
        assert.strictEqual(result.method, data.method);
        assert.strictEqual(result.width, data.width);
        assert.strictEqual(result.height, data.height);
        assert.strictEqual(result.size, data.size);
    });

    it('works with all supported platforms', () => {
        const platforms = ['icloud', 'dropbox', 'gphotos', 'gdrive', 'unknown'];
        for (const platform of platforms) {
            setCurrentPlatform(platform);
            const result = formatJsonSuccess({});
            assert.strictEqual(result.platform, platform);
        }
    });
});

describe('formatJsonError', () => {
    beforeEach(() => {
        setCurrentPlatform('icloud');
    });

    it('returns object with schema_version "1"', () => {
        const result = formatJsonError('TEST_ERROR', 'Test message');
        assert.strictEqual(result.schema_version, '1');
    });

    it('returns object with ok: false', () => {
        const result = formatJsonError('TEST_ERROR', 'Test message');
        assert.strictEqual(result.ok, false);
    });

    it('includes current platform', () => {
        setCurrentPlatform('gphotos');
        const result = formatJsonError('TEST_ERROR', 'Test message');
        assert.strictEqual(result.platform, 'gphotos');
    });

    it('includes error code in error object', () => {
        const result = formatJsonError('NETWORK_ERROR', 'Connection failed');
        assert.strictEqual(result.error.code, 'NETWORK_ERROR');
    });

    it('includes message in error object', () => {
        const result = formatJsonError('AUTH_REQUIRED', 'Login required');
        assert.strictEqual(result.error.message, 'Login required');
    });

    it('includes remediation when provided', () => {
        const result = formatJsonError(
            'AUTH_REQUIRED',
            'Login required',
            'Please enable public sharing'
        );
        assert.strictEqual(result.error.remediation, 'Please enable public sharing');
    });

    it('omits remediation when null', () => {
        const result = formatJsonError('CAPTURE_FAILURE', 'All strategies failed', null);
        assert.strictEqual(result.error.remediation, undefined);
    });

    it('omits remediation when not provided', () => {
        const result = formatJsonError('CAPTURE_FAILURE', 'All strategies failed');
        assert.strictEqual(result.error.remediation, undefined);
    });

    describe('error codes', () => {
        const errorCases = [
            ['CAPTURE_FAILURE', 'All capture strategies failed'],
            ['NETWORK_ERROR', 'Connection timeout'],
            ['AUTH_REQUIRED', 'Login required'],
            ['NOT_FOUND', 'File not found'],
            ['UNSUPPORTED_TYPE', 'Video files not supported'],
            ['INTERNAL_ERROR', 'Unexpected error'],
        ];

        for (const [code, message] of errorCases) {
            it(`handles ${code} error code`, () => {
                const result = formatJsonError(code, message);
                assert.strictEqual(result.error.code, code);
                assert.strictEqual(result.error.message, message);
            });
        }
    });
});

describe('errorCodeToExit', () => {
    it('maps CAPTURE_FAILURE to exit code 1', () => {
        assert.strictEqual(errorCodeToExit['CAPTURE_FAILURE'], ExitCodes.CAPTURE_FAILURE);
        assert.strictEqual(errorCodeToExit['CAPTURE_FAILURE'], 1);
    });

    it('maps USAGE_ERROR to exit code 2', () => {
        assert.strictEqual(errorCodeToExit['USAGE_ERROR'], ExitCodes.USAGE_ERROR);
        assert.strictEqual(errorCodeToExit['USAGE_ERROR'], 2);
    });

    it('maps NETWORK_ERROR to exit code 10', () => {
        assert.strictEqual(errorCodeToExit['NETWORK_ERROR'], ExitCodes.NETWORK_ERROR);
        assert.strictEqual(errorCodeToExit['NETWORK_ERROR'], 10);
    });

    it('maps AUTH_REQUIRED to exit code 11', () => {
        assert.strictEqual(errorCodeToExit['AUTH_REQUIRED'], ExitCodes.AUTH_REQUIRED);
        assert.strictEqual(errorCodeToExit['AUTH_REQUIRED'], 11);
    });

    it('maps NOT_FOUND to exit code 12', () => {
        assert.strictEqual(errorCodeToExit['NOT_FOUND'], ExitCodes.NOT_FOUND);
        assert.strictEqual(errorCodeToExit['NOT_FOUND'], 12);
    });

    it('maps UNSUPPORTED_TYPE to exit code 13', () => {
        assert.strictEqual(errorCodeToExit['UNSUPPORTED_TYPE'], ExitCodes.UNSUPPORTED_TYPE);
        assert.strictEqual(errorCodeToExit['UNSUPPORTED_TYPE'], 13);
    });

    it('maps INTERNAL_ERROR to exit code 20', () => {
        assert.strictEqual(errorCodeToExit['INTERNAL_ERROR'], ExitCodes.INTERNAL_ERROR);
        assert.strictEqual(errorCodeToExit['INTERNAL_ERROR'], 20);
    });

    it('maps CONTENT_TYPE_HTML to AUTH_REQUIRED exit code', () => {
        assert.strictEqual(errorCodeToExit['CONTENT_TYPE_HTML'], ExitCodes.AUTH_REQUIRED);
    });

    it('maps MAGIC_BYTES_HTML to AUTH_REQUIRED exit code', () => {
        assert.strictEqual(errorCodeToExit['MAGIC_BYTES_HTML'], ExitCodes.AUTH_REQUIRED);
    });

    it('covers all expected error codes', () => {
        const expectedCodes = [
            'CAPTURE_FAILURE',
            'USAGE_ERROR',
            'NETWORK_ERROR',
            'AUTH_REQUIRED',
            'NOT_FOUND',
            'UNSUPPORTED_TYPE',
            'INTERNAL_ERROR',
            'CONTENT_TYPE_HTML',
            'MAGIC_BYTES_HTML'
        ];
        for (const code of expectedCodes) {
            assert.ok(
                errorCodeToExit[code] !== undefined,
                `Missing mapping for error code: ${code}`
            );
        }
    });
});
}); // Close wrapper describe('JSON Formatting Tests')
