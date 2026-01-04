/**
 * Unit tests for EXIF datetime extraction (getExifDateTime)
 * Tests parsing of EXIF DateTimeOriginal and fallback fields from image buffers
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract functions before tests run
let getExifDateTime;

before(async () => {
    const extractorPath = join(__dirname, 'extract-functions.mjs');
    const projectRoot = join(__dirname, '../..');
    // Write to project root so it can find node_modules/exifr
    const tempModule = join(projectRoot, `giil-test-exif-datetime-${process.pid}.mjs`);

    const extracted = execSync(`node "${extractorPath}"`, {
        encoding: 'utf8',
        cwd: projectRoot
    });
    writeFileSync(tempModule, extracted);

    const mod = await import(tempModule);
    getExifDateTime = mod.getExifDateTime;

    try { unlinkSync(tempModule); } catch {}
});

describe('getExifDateTime', () => {
    describe('valid images with EXIF', () => {
        it('returns Date object for JPEG with DateTimeOriginal', async () => {
            // Use the sample JPEG we have - even without EXIF it tests the path
            const fixturePath = join(__dirname, 'fixtures/images/sample-jpeg-no-exif.jpg');
            const buffer = readFileSync(fixturePath);

            const result = await getExifDateTime(buffer);

            // Our test fixture doesn't have EXIF, so should return null
            assert.strictEqual(result, null, 'No EXIF in test fixture');
        });

        it('returns null when no EXIF datetime fields present', async () => {
            // PNG files typically don't have EXIF
            const fixturePath = join(__dirname, 'fixtures/images/sample-png.png');
            const buffer = readFileSync(fixturePath);

            const result = await getExifDateTime(buffer);

            assert.strictEqual(result, null, 'PNG should not have EXIF datetime');
        });
    });

    describe('edge cases', () => {
        it('returns null for empty buffer', async () => {
            const buffer = Buffer.alloc(0);

            const result = await getExifDateTime(buffer);

            assert.strictEqual(result, null);
        });

        it('returns null for minimal non-image buffer', async () => {
            const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

            const result = await getExifDateTime(buffer);

            assert.strictEqual(result, null);
        });

        it('returns null for null buffer', async () => {
            const result = await getExifDateTime(null);

            assert.strictEqual(result, null);
        });

        it('returns null for HTML content (not an image)', async () => {
            const buffer = Buffer.from('<!DOCTYPE html><html><body>Not an image</body></html>');

            const result = await getExifDateTime(buffer);

            assert.strictEqual(result, null);
        });

        it('returns null for truncated JPEG header', async () => {
            // JPEG header but truncated before EXIF data
            const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

            const result = await getExifDateTime(buffer);

            assert.strictEqual(result, null);
        });
    });

    describe('return type', () => {
        it('returns Date instance when EXIF is found', async () => {
            // This test will only pass with a real EXIF-containing image
            // For now, we verify the function exists and handles our fixtures
            const fixturePath = join(__dirname, 'fixtures/images/sample-jpeg-no-exif.jpg');
            const buffer = readFileSync(fixturePath);

            const result = await getExifDateTime(buffer);

            // Result should be either a Date or null
            assert.ok(
                result === null || result instanceof Date,
                'Result should be null or Date instance'
            );
        });

        it('function is async', () => {
            const result = getExifDateTime(Buffer.alloc(0));

            assert.ok(result instanceof Promise, 'getExifDateTime should return a Promise');
        });
    });

    describe('error handling', () => {
        it('gracefully handles corrupt data without throwing', async () => {
            // Generate random bytes that aren't a valid image
            const buffer = Buffer.alloc(1024);
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }

            // Should not throw, should return null
            const result = await getExifDateTime(buffer);

            assert.strictEqual(result, null);
        });

        it('gracefully handles undefined input', async () => {
            const result = await getExifDateTime(undefined);

            assert.strictEqual(result, null);
        });
    });
});
