/**
 * Unit tests for Google Drive response validation
 * Tests validateGoogleDriveResponse() for error detection in HTTP responses
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wrap all tests in a parent describe to ensure before() completes first
describe('Google Drive Validation Tests', () => {
    let validateGoogleDriveResponse;
    let tempModule;

    before(async () => {
        const extractorPath = join(__dirname, 'extract-functions.mjs');
        const projectRoot = join(__dirname, "../..");
        tempModule = join(projectRoot, `giil-test-google-drive-validation-${process.pid}.mjs`);
        const extracted = execSync(`node "${extractorPath}"`, { encoding: 'utf8' });
        writeFileSync(tempModule, extracted);
        const mod = await import(tempModule);
        validateGoogleDriveResponse = mod.validateGoogleDriveResponse;
    });

    after(() => {
        if (tempModule && existsSync(tempModule)) {
            try { unlinkSync(tempModule); } catch {}
        }
    });

    describe('validateGoogleDriveResponse', () => {
    describe('valid responses', () => {
        it('accepts valid JPEG buffer', () => {
            // Create a fake JPEG-like buffer (magic bytes + padding)
            const buffer = Buffer.alloc(1000);
            buffer[0] = 0xFF;
            buffer[1] = 0xD8;
            buffer[2] = 0xFF;
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, false);
            assert.strictEqual(result.errorType, null);
            assert.strictEqual(result.message, null);
        });

        it('accepts valid PNG buffer', () => {
            const buffer = Buffer.alloc(500);
            // PNG magic bytes
            buffer.write('\x89PNG\r\n\x1a\n', 0);
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, false);
        });

        it('accepts buffer with binary content', () => {
            // Random binary that doesn't look like HTML
            const buffer = Buffer.alloc(200);
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = (i * 17) % 256; // Pseudo-random binary
            }
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, false);
        });
    });

    describe('empty/small responses', () => {
        it('rejects null buffer', () => {
            const result = validateGoogleDriveResponse(null);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'EMPTY_RESPONSE');
        });

        it('rejects buffer smaller than 100 bytes', () => {
            const buffer = Buffer.alloc(50);
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'EMPTY_RESPONSE');
            assert.ok(result.message.includes('Empty or too small'));
        });

        it('accepts buffer of exactly 100 bytes', () => {
            const buffer = Buffer.alloc(100);
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, false);
        });
    });

    describe('authentication errors', () => {
        it('detects ServiceLogin redirect', () => {
            const html = '<!DOCTYPE html><html><body>Redirect to accounts.google.com/ServiceLogin</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'AUTH_REQUIRED');
            assert.ok(result.message.includes('Login required'));
        });

        it('detects signin redirect', () => {
            const html = '<!DOCTYPE html><html><body>accounts.google.com/signin/v2</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'AUTH_REQUIRED');
        });

        it('detects "Request access" page', () => {
            const html = '<html><body><h1>Request access</h1><p>Ask owner for permission</p></body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'AUTH_REQUIRED');
            assert.ok(result.message.includes('Access denied'));
        });

        it('detects "You need permission" page', () => {
            const html = '<html><body>You need permission to access this resource</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'AUTH_REQUIRED');
        });
    });

    describe('not found errors', () => {
        it('detects "file does not exist" message', () => {
            const html = '<html><body>Sorry, the file you have requested does not exist.</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'NOT_FOUND');
            assert.ok(result.message.includes('not found'));
        });

        it('detects "file could not be found" message', () => {
            const html = '<html><body>The file could not be found. It may have been deleted.</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'NOT_FOUND');
        });
    });

    describe('HTML error responses', () => {
        it('detects <!DOCTYPE html> response', () => {
            const html = '<!DOCTYPE html><html><head><title>Error</title></head><body>Something went wrong</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'HTML_ERROR');
            assert.ok(result.message.includes('HTML instead of image'));
        });

        it('detects <html> tag at start', () => {
            const html = '<html><head></head><body>Error page</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'HTML_ERROR');
        });

        it('handles whitespace before <!DOCTYPE', () => {
            const html = '   <!DOCTYPE html><html><body>Error</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'HTML_ERROR');
        });

        it('handles whitespace before <html', () => {
            const html = '\n\n  <html><body>Error</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.isError, true);
            assert.strictEqual(result.errorType, 'HTML_ERROR');
        });
    });

    describe('error priority', () => {
        it('prioritizes AUTH_REQUIRED over HTML_ERROR', () => {
            // HTML page with login redirect
            const html = '<!DOCTYPE html><html><body>Redirect to accounts.google.com/signin</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            // Should detect as AUTH_REQUIRED, not generic HTML_ERROR
            assert.strictEqual(result.errorType, 'AUTH_REQUIRED');
        });

        it('prioritizes NOT_FOUND over HTML_ERROR', () => {
            const html = '<!DOCTYPE html><html><body>Sorry, the file you have requested does not exist.</body></html>';
            const buffer = Buffer.from(html.padEnd(200, ' '));
            const result = validateGoogleDriveResponse(buffer);
            assert.strictEqual(result.errorType, 'NOT_FOUND');
        });
    });

    describe('large responses', () => {
        it('only checks first 1KB for error patterns', () => {
            // Create a buffer where the error pattern is after 1KB
            const validStart = Buffer.alloc(1500);
            validStart[0] = 0xFF; // JPEG start
            validStart[1] = 0xD8;
            // Put error text after 1KB (should be ignored)
            const errorText = 'accounts.google.com/signin';
            validStart.write(errorText, 1200);
            const result = validateGoogleDriveResponse(validStart);
            assert.strictEqual(result.isError, false);
        });
    });
});
}); // Close wrapper describe('Google Drive Validation Tests')
