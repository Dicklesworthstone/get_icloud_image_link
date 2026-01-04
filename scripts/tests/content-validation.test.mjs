/**
 * Unit tests for content validation functions
 * Tests validateContentType(), validateMagicBytes(), validateImageContent()
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract functions before tests run
let validateContentType, validateMagicBytes, validateImageContent;

before(async () => {
    const extractorPath = join(__dirname, 'extract-functions.mjs');
    const projectRoot = join(__dirname, "../..");
    const tempModule = join(projectRoot, `giil-test-content-validation-${process.pid}.mjs`);

    const extracted = execSync(`node "${extractorPath}"`, { encoding: 'utf8' });
    writeFileSync(tempModule, extracted);

    const mod = await import(tempModule);
    validateContentType = mod.validateContentType;
    validateMagicBytes = mod.validateMagicBytes;
    validateImageContent = mod.validateImageContent;

    try { unlinkSync(tempModule); } catch {}
});

describe('validateContentType', () => {
    describe('Valid image types', () => {
        it('accepts image/jpeg', () => {
            const result = validateContentType('image/jpeg');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.isHtml, false);
        });

        it('accepts image/png', () => {
            const result = validateContentType('image/png');
            assert.strictEqual(result.valid, true);
        });

        it('accepts image/gif', () => {
            const result = validateContentType('image/gif');
            assert.strictEqual(result.valid, true);
        });

        it('accepts image/webp', () => {
            const result = validateContentType('image/webp');
            assert.strictEqual(result.valid, true);
        });

        it('accepts image/heic', () => {
            const result = validateContentType('image/heic');
            assert.strictEqual(result.valid, true);
        });

        it('accepts application/octet-stream (binary fallback)', () => {
            const result = validateContentType('application/octet-stream');
            assert.strictEqual(result.valid, true);
        });

        it('handles charset suffix', () => {
            const result = validateContentType('image/jpeg; charset=utf-8');
            assert.strictEqual(result.valid, true);
        });
    });

    describe('HTML detection', () => {
        it('detects text/html as invalid', () => {
            const result = validateContentType('text/html');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.isHtml, true);
        });

        it('detects text/html with charset', () => {
            const result = validateContentType('text/html; charset=utf-8');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.isHtml, true);
        });

        it('detects application/xhtml+xml', () => {
            const result = validateContentType('application/xhtml+xml');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.isHtml, true);
        });
    });

    describe('Edge cases', () => {
        it('handles null input', () => {
            const result = validateContentType(null);
            assert.strictEqual(result.valid, false);
        });

        it('handles undefined input', () => {
            const result = validateContentType(undefined);
            assert.strictEqual(result.valid, false);
        });

        it('handles empty string', () => {
            const result = validateContentType('');
            assert.strictEqual(result.valid, false);
        });

        it('handles uppercase', () => {
            const result = validateContentType('IMAGE/JPEG');
            assert.strictEqual(result.valid, true);
        });
    });
});

describe('validateMagicBytes', () => {
    describe('Image format detection', () => {
        it('detects JPEG magic bytes (FF D8 FF)', () => {
            const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'jpeg');
            assert.strictEqual(result.isImage, true);
            assert.strictEqual(result.isHtml, false);
        });

        it('detects PNG magic bytes (89 50 4E 47)', () => {
            const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'png');
            assert.strictEqual(result.isImage, true);
        });

        it('detects GIF magic bytes (GIF8)', () => {
            const buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'gif');
            assert.strictEqual(result.isImage, true);
        });

        it('detects WebP magic bytes (RIFF...WEBP)', () => {
            const buffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'webp');
            assert.strictEqual(result.isImage, true);
        });

        it('detects BMP magic bytes (BM)', () => {
            const buffer = Buffer.from([0x42, 0x4D, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'bmp');
            assert.strictEqual(result.isImage, true);
        });

        it('detects TIFF little-endian magic bytes (II)', () => {
            const buffer = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'tiff');
            assert.strictEqual(result.isImage, true);
        });

        it('detects HEIC magic bytes (ftyp heic)', () => {
            const buffer = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'heic');
            assert.strictEqual(result.isImage, true);
        });
    });

    describe('HTML detection', () => {
        it('detects <!DOCTYPE html>', () => {
            const buffer = Buffer.from('<!DOCTYPE html><html>');
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'html');
            assert.strictEqual(result.isHtml, true);
            assert.strictEqual(result.isImage, false);
        });

        it('detects <html> tag', () => {
            const buffer = Buffer.from('<html><head>');
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.isHtml, true);
        });

        it('detects <?xml declaration', () => {
            const buffer = Buffer.from('<?xml version="1.0"?>');
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.isHtml, true);
        });
    });

    describe('Edge cases', () => {
        it('handles null buffer', () => {
            const result = validateMagicBytes(null);
            assert.strictEqual(result.format, 'unknown');
        });

        it('handles buffer too small', () => {
            const buffer = Buffer.from([0xFF, 0xD8]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'unknown');
        });

        it('returns unknown for unrecognized format', () => {
            const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
            const result = validateMagicBytes(buffer);
            assert.strictEqual(result.format, 'unknown');
            assert.strictEqual(result.isImage, false);
            assert.strictEqual(result.isHtml, false);
        });
    });
});

describe('validateImageContent', () => {
    it('validates valid JPEG content and returns magic result', () => {
        const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
        const result = validateImageContent(buffer, 'image/jpeg');
        // Returns magic bytes result for valid content
        assert.strictEqual(result.format, 'jpeg');
        assert.strictEqual(result.isImage, true);
    });

    it('throws CONTENT_TYPE_HTML for HTML content-type', () => {
        const buffer = Buffer.from('<!DOCTYPE html><html><body>Error</body></html>');
        assert.throws(
            () => validateImageContent(buffer, 'text/html'),
            {
                code: 'CONTENT_TYPE_HTML',
                exitCode: 11
            }
        );
    });

    it('throws MAGIC_BYTES_HTML for HTML content with image content-type', () => {
        // Content-type says image but bytes are HTML
        const buffer = Buffer.from('<!DOCTYPE html><html><body>Error</body></html>');
        assert.throws(
            () => validateImageContent(buffer, 'image/jpeg'),
            {
                code: 'MAGIC_BYTES_HTML',
                exitCode: 11
            }
        );
    });

    it('accepts valid image with no content-type header', () => {
        const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
        const result = validateImageContent(buffer, null);
        assert.strictEqual(result.format, 'jpeg');
        assert.strictEqual(result.isImage, true);
    });
});
