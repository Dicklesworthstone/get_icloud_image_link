/**
 * Unit tests for date formatting functions
 * Tests formatDateForFilename() and formatDateForJson()
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

let formatDateForFilename;
let formatDateForJson;

before(async () => {
    const extractorPath = join(__dirname, 'extract-functions.mjs');
    const projectRoot = join(__dirname, "../..");
    const tempModule = join(projectRoot, `giil-test-date-formatting-${process.pid}.mjs`);
    const extracted = execSync(`node "${extractorPath}"`, { encoding: 'utf8' });
    writeFileSync(tempModule, extracted);
    const mod = await import(tempModule);
    formatDateForFilename = mod.formatDateForFilename;
    formatDateForJson = mod.formatDateForJson;
    try { unlinkSync(tempModule); } catch {}
});

describe('formatDateForFilename', () => {
    describe('basic formatting', () => {
        it('formats a date as YYYYMMDD_HHMMSS', () => {
            const date = new Date('2025-03-15T14:30:45.000Z');
            const result = formatDateForFilename(date);
            // Note: result depends on local timezone, so we check format pattern
            assert.match(result, /^\d{8}_\d{6}$/);
        });

        it('pads single-digit months with zero', () => {
            const date = new Date(2025, 0, 5, 9, 5, 3); // Jan 5, 2025 09:05:03 (local)
            const result = formatDateForFilename(date);
            assert.strictEqual(result, '20250105_090503');
        });

        it('handles midnight correctly', () => {
            const date = new Date(2025, 5, 15, 0, 0, 0); // Jun 15, 2025 00:00:00 (local)
            const result = formatDateForFilename(date);
            assert.strictEqual(result, '20250615_000000');
        });

        it('handles end of day correctly', () => {
            const date = new Date(2025, 11, 31, 23, 59, 59); // Dec 31, 2025 23:59:59 (local)
            const result = formatDateForFilename(date);
            assert.strictEqual(result, '20251231_235959');
        });
    });

    describe('edge cases', () => {
        it('handles leap year date', () => {
            const date = new Date(2024, 1, 29, 12, 30, 0); // Feb 29, 2024 (leap year)
            const result = formatDateForFilename(date);
            assert.strictEqual(result, '20240229_123000');
        });

        it('handles year 2000', () => {
            const date = new Date(2000, 0, 1, 0, 0, 0); // Jan 1, 2000
            const result = formatDateForFilename(date);
            assert.strictEqual(result, '20000101_000000');
        });

        it('produces sortable filenames (lexicographic order = chronological)', () => {
            const dates = [
                new Date(2025, 5, 15, 10, 30, 0),
                new Date(2025, 5, 14, 10, 30, 0),
                new Date(2025, 5, 15, 9, 30, 0),
            ];
            const formatted = dates.map(d => formatDateForFilename(d));
            const sorted = [...formatted].sort();
            // Chronological order: Jun 14, Jun 15 9:30, Jun 15 10:30
            assert.strictEqual(sorted[0], '20250614_103000');
            assert.strictEqual(sorted[1], '20250615_093000');
            assert.strictEqual(sorted[2], '20250615_103000');
        });
    });
});

describe('formatDateForJson', () => {
    describe('ISO 8601 format', () => {
        it('returns ISO 8601 string', () => {
            const date = new Date('2025-03-15T14:30:45.000Z');
            const result = formatDateForJson(date);
            assert.strictEqual(result, '2025-03-15T14:30:45.000Z');
        });

        it('includes milliseconds', () => {
            const date = new Date('2025-03-15T14:30:45.123Z');
            const result = formatDateForJson(date);
            assert.ok(result.includes('.123Z'));
        });

        it('output is parseable back to equivalent Date', () => {
            const original = new Date('2025-06-20T08:15:30.500Z');
            const formatted = formatDateForJson(original);
            const parsed = new Date(formatted);
            assert.strictEqual(parsed.getTime(), original.getTime());
        });
    });

    describe('edge cases', () => {
        it('handles epoch time', () => {
            const date = new Date(0); // Unix epoch
            const result = formatDateForJson(date);
            assert.strictEqual(result, '1970-01-01T00:00:00.000Z');
        });

        it('handles far future date', () => {
            const date = new Date('2099-12-31T23:59:59.999Z');
            const result = formatDateForJson(date);
            assert.strictEqual(result, '2099-12-31T23:59:59.999Z');
        });
    });
});
