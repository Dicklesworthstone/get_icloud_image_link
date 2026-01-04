/**
 * Unit tests for Google Drive URL functions
 * Tests extractGoogleDriveFileId, getGoogleDriveDownloadUrl, getGoogleDriveViewerUrl
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract functions before tests run
let extractGoogleDriveFileId;
let getGoogleDriveDownloadUrl;
let getGoogleDriveViewerUrl;

before(async () => {
    // Extract pure functions from giil
    const extractorPath = join(__dirname, 'extract-functions.mjs');
    const projectRoot = join(__dirname, "../..");
    const tempModule = join(projectRoot, `giil-test-google-drive-${process.pid}.mjs`);

    // Run extraction
    const extracted = execSync(`node "${extractorPath}"`, { encoding: 'utf8' });
    writeFileSync(tempModule, extracted);

    // Dynamic import the extracted module
    const mod = await import(tempModule);
    extractGoogleDriveFileId = mod.extractGoogleDriveFileId;
    getGoogleDriveDownloadUrl = mod.getGoogleDriveDownloadUrl;
    getGoogleDriveViewerUrl = mod.getGoogleDriveViewerUrl;

    // Cleanup
    try { unlinkSync(tempModule); } catch {}
});

describe('extractGoogleDriveFileId', () => {
    describe('/file/d/{id}/view format', () => {
        it('extracts ID from standard file view URL', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/file/d/1A2B3C4D5E6F/view'
            );
            assert.strictEqual(id, '1A2B3C4D5E6F');
        });

        it('extracts ID from docs.google.com file URL', () => {
            const id = extractGoogleDriveFileId(
                'https://docs.google.com/file/d/XYZ789ABC/view'
            );
            assert.strictEqual(id, 'XYZ789ABC');
        });

        it('extracts ID with sharing params', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/file/d/ABC123/view?usp=sharing'
            );
            assert.strictEqual(id, 'ABC123');
        });

        it('handles ID with hyphens and underscores', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/file/d/ABC-123_XYZ/view'
            );
            assert.strictEqual(id, 'ABC-123_XYZ');
        });
    });

    describe('/open?id={id} format', () => {
        it('extracts ID from open URL', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/open?id=OPEN123'
            );
            assert.strictEqual(id, 'OPEN123');
        });

        it('extracts ID with additional params', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/open?id=OPEN456&usp=sharing'
            );
            assert.strictEqual(id, 'OPEN456');
        });
    });

    describe('?id={id} and &id={id} format', () => {
        it('extracts ID from query param at start', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/some/path?id=QUERY123'
            );
            assert.strictEqual(id, 'QUERY123');
        });

        it('extracts ID from query param after other params', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/some/path?foo=bar&id=QUERY456'
            );
            assert.strictEqual(id, 'QUERY456');
        });
    });

    describe('invalid inputs', () => {
        it('returns null for empty string', () => {
            const id = extractGoogleDriveFileId('');
            assert.strictEqual(id, null);
        });

        it('returns null for malformed URL (missing d/ segment)', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/file/NOID/view'
            );
            assert.strictEqual(id, null);
        });

        it('returns null for URL without ID patterns', () => {
            const id = extractGoogleDriveFileId(
                'https://drive.google.com/drive/folders/ABC123'
            );
            assert.strictEqual(id, null);
        });
    });

    describe('domain-agnostic matching', () => {
        // Note: The function is domain-agnostic - it extracts IDs based on
        // URL patterns regardless of domain. Domain validation happens earlier
        // in detectPlatform(). This is by design.
        it('extracts ID from any domain with matching pattern', () => {
            // This behavior is expected - the function only validates pattern, not domain
            const id = extractGoogleDriveFileId(
                'https://example.com/file/d/ANYSITE123/view'
            );
            assert.strictEqual(id, 'ANYSITE123');
        });
    });
});

describe('getGoogleDriveDownloadUrl', () => {
    it('constructs download URL with uc?export=download format', () => {
        const url = getGoogleDriveDownloadUrl('ABC123');
        assert.strictEqual(url, 'https://drive.google.com/uc?export=download&id=ABC123');
    });

    it('handles ID with special characters', () => {
        const url = getGoogleDriveDownloadUrl('ABC-123_XYZ');
        assert.strictEqual(url, 'https://drive.google.com/uc?export=download&id=ABC-123_XYZ');
    });

    it('handles long ID', () => {
        const longId = 'A'.repeat(100);
        const url = getGoogleDriveDownloadUrl(longId);
        assert.ok(url.includes(longId));
        assert.ok(url.startsWith('https://drive.google.com/uc?export=download&id='));
    });
});

describe('getGoogleDriveViewerUrl', () => {
    it('constructs viewer URL with /file/d/ format', () => {
        const url = getGoogleDriveViewerUrl('XYZ789');
        assert.strictEqual(url, 'https://drive.google.com/file/d/XYZ789/view');
    });

    it('handles ID with special characters', () => {
        const url = getGoogleDriveViewerUrl('XYZ-789_ABC');
        assert.strictEqual(url, 'https://drive.google.com/file/d/XYZ-789_ABC/view');
    });

    it('returns URL that extractGoogleDriveFileId can parse back', () => {
        const originalId = 'ROUNDTRIP123';
        const viewerUrl = getGoogleDriveViewerUrl(originalId);
        const extractedId = extractGoogleDriveFileId(viewerUrl);
        assert.strictEqual(extractedId, originalId);
    });
});

describe('integration: URL roundtrip', () => {
    it('extracts ID from viewer URL and rebuilds download URL', () => {
        const viewerUrl = 'https://drive.google.com/file/d/INTEGRATED123/view?usp=sharing';
        const id = extractGoogleDriveFileId(viewerUrl);
        const downloadUrl = getGoogleDriveDownloadUrl(id);

        assert.strictEqual(id, 'INTEGRATED123');
        assert.strictEqual(downloadUrl, 'https://drive.google.com/uc?export=download&id=INTEGRATED123');
    });

    it('generates consistent URLs for same file ID', () => {
        const id = 'CONSISTENT456';
        const viewer1 = getGoogleDriveViewerUrl(id);
        const viewer2 = getGoogleDriveViewerUrl(id);
        const download1 = getGoogleDriveDownloadUrl(id);
        const download2 = getGoogleDriveDownloadUrl(id);

        assert.strictEqual(viewer1, viewer2);
        assert.strictEqual(download1, download2);
    });
});
