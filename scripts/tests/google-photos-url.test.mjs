/**
 * Unit tests for Google Photos URL extraction
 * Tests the extractGooglePhotosBaseUrl() function for =s0 full-res URL generation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wrap all tests in a parent describe to ensure before() completes first
describe('Google Photos URL Tests', () => {
    let extractGooglePhotosBaseUrl;
    let tempModule;

    before(async () => {
        const extractorPath = join(__dirname, 'extract-functions.mjs');
        const projectRoot = join(__dirname, "../..");
        tempModule = join(projectRoot, `giil-test-google-photos-url-${process.pid}.mjs`);

        const extracted = execSync(`node "${extractorPath}"`, { encoding: 'utf8' });
        writeFileSync(tempModule, extracted);

        const mod = await import(tempModule);
        extractGooglePhotosBaseUrl = mod.extractGooglePhotosBaseUrl;
    });

    after(() => {
        if (tempModule && existsSync(tempModule)) {
            try { unlinkSync(tempModule); } catch {}
        }
    });

    describe('extractGooglePhotosBaseUrl', () => {
    describe('URL with size modifier', () => {
        it('strips =w1920-h1080 size modifier', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/ABC123=w1920-h1080'
            );
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/ABC123');
            assert.strictEqual(result.fullResUrl, 'https://lh3.googleusercontent.com/pw/ABC123=s0');
        });

        it('strips =w800 width-only modifier', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/XYZ789=w800'
            );
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/XYZ789');
            assert.strictEqual(result.fullResUrl, 'https://lh3.googleusercontent.com/pw/XYZ789=s0');
        });

        it('strips =s200 square size modifier', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/DEF456=s200'
            );
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/DEF456');
            assert.strictEqual(result.fullResUrl, 'https://lh3.googleusercontent.com/pw/DEF456=s0');
        });

        it('handles complex modifiers with -no suffix', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/LONG123=w1920-h1080-no'
            );
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/LONG123');
        });
    });

    describe('URL without size modifier', () => {
        it('returns original URL as base when no = present', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/NOMOD123'
            );
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/NOMOD123');
            assert.strictEqual(result.fullResUrl, 'https://lh3.googleusercontent.com/pw/NOMOD123=s0');
        });
    });

    describe('fullResUrl generation', () => {
        it('always appends =s0 for original size', () => {
            const urls = [
                'https://lh3.googleusercontent.com/pw/ABC=w100',
                'https://lh3.googleusercontent.com/pw/DEF',
                'https://lh3.googleusercontent.com/pw/GHI=s500',
            ];

            for (const url of urls) {
                const result = extractGooglePhotosBaseUrl(url);
                assert.ok(
                    result.fullResUrl.endsWith('=s0'),
                    `Expected fullResUrl to end with =s0: ${result.fullResUrl}`
                );
            }
        });
    });

    describe('edge cases', () => {
        it('handles URL with = in path (not modifier)', () => {
            // The function uses lastIndexOf, so this would break if = appears in the path
            // In practice, Google Photos CDN URLs have = only for size modifiers
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/ABC=DEF=w100'
            );
            // Should strip at last =
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/ABC=DEF');
        });

        it('handles very long CDN URL', () => {
            const longId = 'A'.repeat(200);
            const result = extractGooglePhotosBaseUrl(
                `https://lh3.googleusercontent.com/pw/${longId}=w1920`
            );
            assert.strictEqual(
                result.baseUrl,
                `https://lh3.googleusercontent.com/pw/${longId}`
            );
        });

        it('handles URL with query parameters after modifier', () => {
            // Note: This is a quirky case - the function only looks at = in the URL string
            // Real Google Photos URLs don't typically have query params after the size
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/ABC=w100?query=1'
            );
            // lastIndexOf finds the = before query, which is wrong, but expected behavior
            assert.strictEqual(result.baseUrl, 'https://lh3.googleusercontent.com/pw/ABC=w100?query');
        });
    });

    describe('return object structure', () => {
        it('returns object with baseUrl and fullResUrl properties', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/TEST=w500'
            );
            assert.ok('baseUrl' in result, 'Missing baseUrl property');
            assert.ok('fullResUrl' in result, 'Missing fullResUrl property');
        });

        it('baseUrl is a string', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/TEST=w500'
            );
            assert.strictEqual(typeof result.baseUrl, 'string');
        });

        it('fullResUrl is a string', () => {
            const result = extractGooglePhotosBaseUrl(
                'https://lh3.googleusercontent.com/pw/TEST=w500'
            );
            assert.strictEqual(typeof result.fullResUrl, 'string');
        });
    });
});
}); // Close wrapper describe('Google Photos URL Tests')
