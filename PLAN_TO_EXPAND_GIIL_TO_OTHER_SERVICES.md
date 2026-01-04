# Plan to Expand giil to Support Multiple Cloud Services

> **giil** — *Get Image [from] Internet Link*
>
> Originally built for iCloud, now expanding to become the universal CLI tool for downloading images from any cloud sharing service.

---

## Document Purpose

This document presents a comprehensive plan for expanding giil from an iCloud-only image downloader to a multi-platform tool supporting Dropbox, Google Photos, and Google Drive. It is intended to be **self-contained** — providing all context necessary for technical review, including:

- Complete background on the existing giil architecture
- The problem domain and why cloud image download is technically challenging
- Detailed research findings from hands-on Playwright testing
- Specific implementation strategies for each platform
- Code examples, URL patterns, and selector references
- Edge cases, error handling, and testing strategies

**Audience:** This document is written for LLM reviewers, developers, or technical stakeholders who need to understand and evaluate the proposed changes without prior knowledge of the project.

---

## Table of Contents

1. [Background: What is giil?](#background-what-is-giil)
2. [The Problem Domain](#the-problem-domain)
3. [Current Architecture](#current-architecture)
4. [Research Methodology](#research-methodology)
5. [Executive Summary](#executive-summary)
6. [Design Goals & Non-Goals](#design-goals--non-goals)
7. [Security, Privacy, and Compliance](#security-privacy-and-compliance)
8. [Rebranding Strategy](#rebranding-strategy)
9. [Platform Analysis](#platform-analysis)
   - [Dropbox](#1-dropbox)
   - [Google Photos](#2-google-photos)
   - [Google Drive](#3-google-drive)
10. [Technical Architecture](#technical-architecture)
11. [Implementation Plan](#implementation-plan)
12. [URL Detection Patterns](#url-detection-patterns)
13. [Capture Strategies by Platform](#capture-strategies-by-platform)
14. [Error Handling](#error-handling)
15. [Testing Strategy](#testing-strategy)
16. [Migration & Backwards Compatibility](#migration--backwards-compatibility)
17. [Future Platforms](#future-platforms)
18. [Appendix: Research Data](#appendix-research-data)

---

## Background: What is giil?

### Origin and Purpose

**giil** (originally "Get iCloud Image Link", now "Get Image [from] Internet Link") is a command-line tool that downloads full-resolution images from cloud photo sharing services. It was created to solve a specific workflow problem:

> **The Scenario:** You're SSH'd into a remote server running an AI coding assistant (Claude Code, Codex, etc.). You need to debug a UI issue on your iPhone, but how do you get that screenshot to your remote terminal session?

The traditional solutions (SCP, email, cloud sync setup) all require context-switching and break the coding flow. giil enables a seamless workflow:

1. Screenshot on iPhone → iCloud syncs automatically
2. Share via Photos.app → Copy iCloud Link
3. Paste link into remote terminal → Run giil
4. AI assistant can now see and analyze the image

### Current Capabilities (v2.1.0)

| Feature | Description |
|---------|-------------|
| **Platform** | iCloud photo shares only |
| **Single photos** | Download individual shared photos |
| **Albums** | Download all photos from shared albums (`--all`) |
| **Output formats** | File path (default), JSON metadata, Base64 encoding |
| **Image processing** | MozJPEG compression, EXIF datetime extraction, HEIC conversion |
| **Quality control** | Configurable JPEG quality (1-100) |
| **Debug mode** | Save screenshots and HTML on failure |

> **Note:** v3 changes the default to preserve original bytes (compression becomes opt-in). See [Output Processing Defaults](#output-processing-defaults-v3-behavior-change).

### Installation

giil is distributed with an installer that fetches **versioned release artifacts** (not the moving `main` branch). This keeps installs reproducible and safer:

```bash
# Install latest stable release (recommended)
curl -fsSL "https://github.com/Dicklesworthstone/giil/releases/latest/download/install.sh" | bash

# With checksum verification
curl -fsSL "https://github.com/Dicklesworthstone/giil/releases/latest/download/install.sh" | GIIL_VERIFY=1 bash
```

Optional distribution channels (future):
- `npm install -g giil` (Node.js users)
- Homebrew formula (macOS/Linux)

### Basic Usage

```bash
# Download single photo (preserves original bytes by default in v3)
giil "https://share.icloud.com/photos/xxx"

# Download with JSON metadata
giil "https://share.icloud.com/photos/xxx" --json

# Download all photos from album
giil "https://share.icloud.com/photos/xxx" --all

# Output as base64 (no file saved)
giil "https://share.icloud.com/photos/xxx" --base64

# Opt-in conversion + optimization (lossy)
giil "https://share.icloud.com/photos/xxx" --convert jpeg --quality 85 --optimize

# Get the resolved direct URL (useful for debugging or piping)
giil "https://share.icloud.com/photos/xxx" --print-url
```

---

## The Problem Domain

### Why Cloud Image Download is Hard

Cloud photo sharing services are designed for **human consumption**, not programmatic access. They present unique challenges:

| Challenge | Why It's Hard | Traditional Tools Fail |
|-----------|---------------|------------------------|
| **JavaScript-heavy SPAs** | Pages render dynamically via JS | `curl`/`wget` get empty HTML |
| **Dynamic image loading** | Images load asynchronously from CDN | No static URLs to scrape |
| **Session-specific URLs** | CDN URLs expire quickly | Can't bookmark or cache |
| **Copy protection** | No right-click download | Screenshots lose quality |
| **HEIC format** | Apple devices use HEIC | Many tools can't process |
| **Anti-scraping measures** | Rate limiting, CAPTCHAs | Automation gets blocked |

### The Solution: Headless Browser + Network Interception

giil uses **Playwright** (headless Chromium) to:

1. Render the JavaScript-heavy page like a real browser
2. Intercept network requests to capture CDN image URLs
3. Click native download buttons when available
4. Fall back to element/viewport screenshots if all else fails

This approach mimics human behavior while capturing the highest quality image available.

### Playwright Reliability & Performance Practices (v3)

To keep headless automation fast and stable across SPAs:

- **Reuse one browser per invocation** (and multiple pages if `--all --jobs > 1`).
- Prefer **targeted waits** (e.g., "wait for a viewer element" or "wait until at least one candidate URL observed") over `networkidle` which is flaky on SPAs.
- Optionally **block non-essential resources** (fonts, tracking, ads) to reduce load time and bandwidth.
- Provide **`--trace`** to save Playwright traces for hard-to-reproduce failures.
- Provide **`--debug-dir <path>`** to write HTML/screenshots/HAR/trace to a specific directory.

---

## Current Architecture

### Hybrid Bash + Node.js Design

giil uses a two-layer architecture. This works well for iCloud, but it becomes harder to extend safely as platforms and edge cases grow:

```
┌─────────────────────────────────────────────────────────────────┐
│  BASH LAYER (giil script, ~1,500 lines)                        │
│                                                                  │
│  Responsibilities:                                               │
│  • CLI argument parsing and validation                          │
│  • OS detection (macOS vs Linux)                                │
│  • Dependency auto-installation (Node.js, Playwright, Sharp)    │
│  • URL normalization                                             │
│  • XDG-compliant cache management (~/.cache/giil/)              │
│  • Extractor script generation (heredoc)                        │
│  • Process orchestration                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  NODE.JS LAYER (extractor.mjs, ~585 lines, embedded)           │
│                                                                  │
│  Responsibilities:                                               │
│  • Playwright browser automation                                 │
│  • Network interception (capture CDN responses)                 │
│  • 4-tier capture strategy execution                            │
│  • EXIF metadata extraction (via exifr)                         │
│  • Image processing (Sharp + MozJPEG)                           │
│  • HEIC/HEIF conversion                                          │
│  • Output formatting (file path, JSON, base64)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Scaling Risk (Why v4+ May Need Architecture Changes)

As we add Dropbox + Google Photos + Google Drive, the current layout has three compounding issues:

1. **Testability:** Bash logic is difficult to unit test and refactor safely.
2. **Duplication:** Platform detection/normalization appears in both bash and JS, which will drift.
3. **Maintainability:** Embedding a growing JS program via heredoc makes review and modularization harder.

**v3 approach:** Keep the current hybrid architecture for 4 platforms (manageable).
**v4+ consideration:** If we add 5+ platforms, move to a thin POSIX shell wrapper with a modular Node.js core:

```
giil (thin POSIX shell wrapper)
└── node dist/giil.mjs (bundled Node core)
    ├── cli/                  # argument parsing, help, exit codes
    ├── platform/             # platform adapters (icloud, dropbox, gphotos, gdrive)
    ├── acquire/              # direct HTTP, Playwright acquisition, verification
    ├── process/              # optional conversion/compression/metadata extraction
    ├── output/               # path/json/jsonl/base64/stdout
    └── debug/                # artifacts, tracing, structured logs
```

**Key rule for v4+:** Platform detection + URL normalization lives in *one place* (Node core). Bash does not re-implement it.

### The 4-Tier Capture Strategy (iCloud)

giil implements a **fallback chain** to maximize reliability:

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 1: Download Button (Highest Quality)                     │
│                                                                 │
│  • Locate visible Download button (9 CSS selectors)            │
│  • Click and wait for browser download event                   │
│  • Capture original file (preserves HEIC, no re-encoding)      │
│  • Selectors: button[aria-label="Download"], etc.              │
└────────────────────────────────────────────────────────────────┘
        │ Fail (button not found or download doesn't trigger)
        ▼
┌────────────────────────────────────────────────────────────────┐
│  TIER 2: Network Interception (Full Resolution)                │
│                                                                 │
│  • Monitor all HTTP responses during page load                 │
│  • Filter for iCloud CDN domains (cvws.icloud-content.com)     │
│  • Keep largest image buffer (>10KB threshold)                 │
│  • Captures full-resolution CDN images                         │
└────────────────────────────────────────────────────────────────┘
        │ Fail (no large image captured)
        ▼
┌────────────────────────────────────────────────────────────────┐
│  TIER 3: Element Screenshot                                     │
│                                                                 │
│  • Query for image elements (10 CSS selectors)                 │
│  • Verify element is visible and ≥100×100 pixels               │
│  • Take PNG screenshot of the element                          │
│  • Selectors: img[src*="icloud-content"], .photo-viewer img    │
└────────────────────────────────────────────────────────────────┘
        │ Fail (no suitable image element found)
        ▼
┌────────────────────────────────────────────────────────────────┐
│  TIER 4: Viewport Screenshot (Last Resort)                      │
│                                                                 │
│  • Capture entire visible viewport (1920×1080)                 │
│  • May include UI chrome and overlays                          │
│  • Always succeeds if page loads                               │
└────────────────────────────────────────────────────────────────┘
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **Node.js** | ≥18 | JavaScript runtime |
| **Playwright** | 1.40.0 | Browser automation framework |
| **Chromium** | (via Playwright) | Headless browser |
| **Sharp** | 0.33.0 | Image processing + MozJPEG |
| **exifr** | 7.1.3 | EXIF/IPTC/XMP metadata parsing |
| **gum** | (optional) | Beautiful CLI output |

### File Structure

```
~/.cache/giil/                    # XDG-compliant cache
├── node_modules/                 # npm packages
├── ms-playwright/                # Chromium browser
├── extractor.mjs                 # Generated Node.js script
├── package.json                  # npm manifest
└── .installed                    # Installation marker

~/.local/bin/giil                 # Main executable
```

---

## Research Methodology

### Approach

This plan is based on **hands-on testing** using Playwright to analyze each target platform. The research involved:

1. **Web research** — Searching for existing solutions, API documentation, known limitations
2. **Direct URL testing** — Testing URL manipulation approaches with curl
3. **Playwright analysis** — Loading pages, intercepting network requests, analyzing DOM
4. **Full capture testing** — Simulating giil's 4-tier strategy on each platform

### Test URLs Used

All platforms were tested with the same source image (a 2760×2288 PNG screenshot):

| Platform | Test URL |
|----------|----------|
| **Dropbox** | `https://www.dropbox.com/scl/fi/zn6fqhtdp9n0lg1p8fqnw/Snipping_-Project-Evaluation_2026-01-03_14-21-36.png?rlkey=yepbzauiujfm7bz1uag657l1y&st=2gwnzoy6&dl=0` |
| **Google Photos** | `https://photos.app.goo.gl/Lj8uLE74GW53FpCM7` |
| **Google Drive** | `https://drive.google.com/file/d/1GRmX8FjAidi86vxXyCUfrc53kl7Jvqn3/view?usp=drive_link` |

### Test Environment

- **Date:** January 3, 2026
- **Playwright:** 1.40.0
- **Chromium:** 120.0.6099.28
- **Node.js:** 24.12.0
- **Platform:** Linux (Ubuntu)

---

## Executive Summary

### Feasibility Assessment

| Platform | Feasibility | Difficulty | Browser Required | Full Resolution |
|----------|-------------|------------|------------------|-----------------|
| **iCloud** | ✅ Proven | Medium | Yes (Playwright) | ✅ Yes |
| **Dropbox** | ✅ Excellent | Easy | **No (curl only!)** | ✅ Yes |
| **Google Photos** | ✅ Good | Medium | Yes (for URL extraction) | ✅ Yes |
| **Google Drive** | ⚠️ Conditional | Hard | Yes + auth handling | Depends on sharing |

### Verified Test Results

```
Platform          Method                  Resolution    Size      Status
─────────────────────────────────────────────────────────────────────────
Dropbox           Direct URL (raw=1)      2760×2288    2.27 MB   ✅ FULL
Google Photos     URL extract + =s0       2760×2288    2.14 MB   ✅ FULL
Dropbox           Playwright network      1600×1326    1.29 MB   ⚠️ Preview
Google Photos     Playwright network      1040×862     624 KB    ⚠️ Preview
Google Drive      All methods             N/A          N/A       ❌ Requires public share
```

### Key Insight

**The naive approach (Playwright network interception) only captures preview-resolution images.** To get full resolution:

- **Dropbox:** Simple URL manipulation (`dl=0` → `raw=1`) — no browser needed!
- **Google Photos:** Extract CDN base URL, append `=s0` size modifier
- **Google Drive:** Complex due to 2024 API changes; requires proper public sharing

### Implementation Priority

1. **Dropbox** — Trivial implementation, no browser needed, immediate value
2. **Google Photos** — Proven strategy, moderate effort, high value
3. **Google Drive** — Complex, conditional success, implement last (as experimental)

---

## Design Goals & Non-Goals

### Design Goals

The expanded giil should be opinionated about a few core properties:

1. **Highest-available quality by default** — prefer original bytes/original resolution when the share permits it.
2. **Fast paths first** — avoid Playwright when a direct download URL exists (e.g., Dropbox `raw=1`).
3. **Deterministic + scriptable** — stable exit codes, stable JSON schema, predictable file naming.
4. **Robust fallbacks** — when a best-quality strategy fails, fall back in a controlled way with clear provenance (`platform`, `method`, `tier`).
5. **Extensible by design** — adding a platform should follow a clear pattern (Platform Adapter interface).

### Non-Goals

To keep the project safe, maintainable, and aligned with platform expectations:

- **No bypassing authentication, CAPTCHAs, or access controls.** giil only works with publicly shared content.
- **No credential harvesting.** Any optional auth mode (future) must be explicitly opt-in and user-supplied.
- **No "bulk scraping" positioning.** giil is a *single-link / album download helper* for developer workflows, not a scraping tool.
- **No silent quality degradation.** If we can't get full resolution, fail loudly or warn clearly.

---

## Security, Privacy, and Compliance

### Security & Privacy Posture

- Treat every input URL and downloaded file as **untrusted input**.
- Validate `Content-Type` headers and magic bytes — reject HTML masquerading as images.
- Keep all cached data local and easy to purge (`giil cache clean`).
- Store debug artifacts (HTML/screenshots/traces) **only when requested** (`--debug`, `--trace`) and in a user-controlled directory.

### Compliance & Rate Limiting

- Default to **polite request rates** and provide configurable throttling to reduce triggering anti-abuse systems.
- Documentation should include a short note reminding users to comply with each service's Terms of Service and applicable laws.
- For `--all` (album downloads), implement sensible defaults (e.g., 1 request/second) with `--rate-limit` override.

### Content Validation (Critical)

Direct downloads can return HTML error pages (password prompts, expired links) with HTTP 200. All acquisition methods must:

1. Validate `Content-Type` is an image (or sniff magic bytes)
2. Detect HTML bodies and return a clear "auth/password required" error
3. Never silently save HTML as an "image"

---

## Rebranding Strategy

### Name Evolution

The tool's name can be reinterpreted to reflect its expanded scope:

```
Original:  giil = "Get iCloud Image Link"
Expanded:  giil = "Get Image [from] Internet Link"
```

This preserves the existing command name while broadening its meaning.

### README Updates Required

The README needs a comprehensive rewrite to reflect the expanded scope while preserving the `giil` command name.

#### 1. Header and Branding

```markdown
<h1 align="center">giil</h1>
<h3 align="center">Get Image [from] Internet Link</h3>

<p align="center">
  <em>Originally built for iCloud, now supporting Dropbox, Google Photos, and Google Drive</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platforms-iCloud%20%7C%20Dropbox%20%7C%20Google-blue?style=for-the-badge" />
</p>
```

#### 2. Origin Story Section (New)

Add a dedicated section explaining the name:

```markdown
## About the Name

**giil** originally stood for "Get iCloud Image Link" when it was created to solve
a specific problem: getting iPhone screenshots to a remote terminal session for
AI coding assistants to analyze.

As the tool expanded to support more platforms, the name was reinterpreted as
"Get Image [from] Internet Link" — preserving the familiar command while reflecting
its broader capabilities. The `giil` command remains unchanged.
```

#### 3. Platform Support Table (New)

```markdown
## Supported Platforms

| Platform | Method | Speed | Full Resolution |
|----------|--------|-------|-----------------|
| **iCloud** | Playwright (4-tier strategy) | 5-15s | ✅ Yes |
| **Dropbox** | Direct URL (no browser!) | 1-3s | ✅ Yes |
| **Google Photos** | URL extraction + direct download | 5-10s | ✅ Yes |
| **Google Drive** | Playwright [experimental] | 5-15s | Depends on sharing |
```

#### 4. Usage Examples by Platform (New)

```markdown
## Quick Start

### iCloud
giil "https://share.icloud.com/photos/xxx"

### Dropbox
giil "https://www.dropbox.com/scl/fi/xxx/photo.png?dl=0"

### Google Photos
giil "https://photos.app.goo.gl/xxx"

### Google Drive (experimental)
giil "https://drive.google.com/file/d/xxx/view"
```

#### 5. Platform-Specific Troubleshooting (New)

Each platform should have a troubleshooting subsection:

- **Dropbox:** Password-protected links, expired links
- **Google Photos:** Private albums, video content handling
- **Google Drive:** "Anyone with the link" requirement, file type detection
- **iCloud:** Existing troubleshooting (unchanged)

#### 6. Sections to Update

| Section | Changes Needed |
|---------|----------------|
| **Title/Header** | New name interpretation, platform badges |
| **Features** | Add platform support, update output format description |
| **Installation** | Update to versioned releases URL |
| **Usage** | Add examples for each platform |
| **How It Works** | Update architecture diagram to show platform routing |
| **Options** | Add new flags (`--print-url`, `--convert`, `--optimize`, `--trace`) |
| **Exit Codes** | Update table with new codes (10-13, 20) |
| **Troubleshooting** | Platform-specific subsections |
| **FAQ** | Add "Why the name?" and platform-specific questions |

#### 7. Migration Notice for v2 Users

```markdown
## Upgrading from v2.x

giil v3 is backwards compatible — all existing iCloud commands work unchanged.

**Key changes:**
- New platforms: Dropbox, Google Photos, Google Drive (experimental)
- Default behavior: Original bytes preserved (compression now opt-in via `--optimize`)
- New JSON fields: `schema_version`, `ok`, `platform`
- New exit codes for better scripting (see Exit Codes section)
```

---

## Platform Analysis

### 1. Dropbox

#### Overview

Dropbox is the **easiest platform to support** — full-resolution downloads work with simple URL manipulation, no browser automation required.

#### URL Formats

```
Standard share:  https://www.dropbox.com/scl/fi/{FILE_ID}/{FILENAME}?rlkey={KEY}&dl=0
Legacy share:    https://www.dropbox.com/s/{FILE_ID}/{FILENAME}?dl=0
Folder share:    https://www.dropbox.com/sh/{FOLDER_ID}/{FOLDER_NAME}?dl=0
```

#### Direct Download Strategy

Simply change the `dl` parameter:

| Parameter | Behavior |
|-----------|----------|
| `dl=0` | Opens web preview (default) |
| `dl=1` | Forces download (returns file with `application/binary`) |
| `raw=1` | Returns raw file with correct MIME type |

**Recommended:** Use `raw=1` for best results with images.

#### Validation Rules (Important)

Direct Dropbox downloads can return HTML error pages (password prompt, expired link) with HTTP 200.
Therefore, Dropbox support must:

1. Validate `Content-Type` is an image (or sniff magic bytes)
2. Detect HTML bodies and return a clear "auth/password required" error
3. Avoid Playwright by default (only enable browser mode with an explicit flag like `--browser`)

#### Transformation Examples

```bash
# Input (preview mode)
https://www.dropbox.com/scl/fi/zn6fqhtdp9n0lg1p8fqnw/photo.png?rlkey=abc123&dl=0

# Output (direct download)
https://www.dropbox.com/scl/fi/zn6fqhtdp9n0lg1p8fqnw/photo.png?rlkey=abc123&raw=1
```

#### Test Results

```
Direct URL (raw=1):
  HTTP Status:  200
  Content-Type: image/png
  Resolution:   2760×2288
  File size:    2,381,863 bytes (2.27 MB)
  Status:       ✅ Full resolution, no browser needed

Playwright network capture (for comparison):
  Resolution:   1600×1326
  File size:    1,356,897 bytes (1.29 MB)
  Status:       ⚠️ Preview resolution only (from previews.dropboxusercontent.com)
```

#### Implementation

```bash
normalize_dropbox_url() {
    local url="$1"
    # Remove any existing dl or raw parameter, then add raw=1
    url=$(echo "$url" | sed -E 's/[&?](dl|raw)=[01]//g')
    if [[ "$url" == *"?"* ]]; then
        echo "${url}&raw=1"
    else
        echo "${url}?raw=1"
    fi
}

download_dropbox() {
    local url="$1"
    local output="$2"
    local raw_url=$(normalize_dropbox_url "$url")
    curl -sL "$raw_url" -o "$output"
}
```

#### No Playwright Needed!

Dropbox direct downloads work with simple HTTP requests. This means:
- Faster execution (no browser startup) — **1-3 seconds vs 5-15 seconds**
- Lower resource usage (no Chromium)
- More reliable (fewer moving parts)

#### Album/Folder Support

- Shared folders with `dl=1` download as ZIP
- Limit: 250GB uncompressed, 10,000 files maximum
- Implementation: Download ZIP, extract, process each image
- **Security:** Prevent zip-slip attacks (no `../` paths), enforce file count/size limits, and only accept image MIME types by default

#### Edge Cases

1. **Password-protected shares** — Will fail; must handle gracefully
2. **Expired links** — Return clear error message
3. **Large files** — May need progress indication

---

### 2. Google Photos

#### Overview

Google Photos requires Playwright for URL extraction, but once the CDN URL is obtained, full-resolution downloads are straightforward.

#### URL Formats

```
Short link:     https://photos.app.goo.gl/{SHARE_ID}
Full link:      https://photos.google.com/share/{ALBUM_ID}?key={KEY}
```

#### Redirect Behavior

```
photos.app.goo.gl/{ID}
    ↓ (HTTP 302)
photos.google.com/share/{ALBUM_ID}?key={KEY}
```

#### CDN URL Structure

Images are served from `lh3.googleusercontent.com` with size parameters:

```
Base URL:   https://lh3.googleusercontent.com/pw/{IMAGE_PATH}
With size:  https://lh3.googleusercontent.com/pw/{IMAGE_PATH}=w1042-h862-no
```

#### Size Modifiers (Tested)

| Suffix | Result | Use Case |
|--------|--------|----------|
| `=w1042-h862-no` | 1040×862 | Default preview |
| `=w0` | 2760×2288 | Full resolution |
| `=s0` | 2760×2288 | **Best for downloads** |
| `=w4000` | 2760×2288 | Capped at original |

**Recommended:** Use `=s0` for original quality.

#### Test Results

```
URL extraction + =s0:
  HTTP Status:  200
  Content-Type: image/png
  Resolution:   2760×2288
  File size:    2,244,002 bytes (2.14 MB)
  Status:       ✅ Full resolution

Playwright network capture (for comparison):
  Resolution:   1040×862
  File size:    639,058 bytes (624 KB)
  Status:       ⚠️ Preview resolution only
```

#### Capture Strategy

```javascript
async function captureGooglePhotos(page, url) {
    let photoBaseUrl = null;

    // Install network interceptor BEFORE navigation
    page.on('response', async (response) => {
        const respUrl = response.url();
        if (respUrl.includes('lh3.googleusercontent.com/pw/')) {
            // Extract base URL (before size parameters)
            photoBaseUrl = respUrl.split('=')[0];
        }
    });

    // Navigate and wait for a viewer element (more reliable than networkidle)
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for either: CDN URL captured OR viewer element visible
    await Promise.race([
        page.waitForFunction(() => window.__photoUrlCaptured, { timeout: 15000 }).catch(() => {}),
        page.waitForSelector('[data-latest-bg], .RY3tic', { timeout: 15000 }).catch(() => {})
    ]);

    // Brief settle time for any final network requests
    await page.waitForTimeout(1000);

    if (photoBaseUrl) {
        // Download full resolution directly
        const fullResUrl = photoBaseUrl + '=s0';
        return await downloadDirect(fullResUrl);
    }

    // Fallback to element screenshot
    return await captureElementScreenshot(page);
}
```

#### Album Support

Albums are the highest-risk area for DOM churn. Prefer a **multi-signal approach**:

1. First attempt to extract item URLs from **network traffic** (collect all `lh3.googleusercontent.com/...` candidates)
2. If no candidates found, attempt to locate thumbnails using **semantically stable selectors**:
   - role-based selectors (Playwright locators)
   - `aria-label` / `data-*` attributes when available
3. Only if needed, fall back to brittle class-based selectors discovered during research

```javascript
const thumbnailSelectors = [
    // Prefer semantic selectors first (more stable)
    '[role="listitem"] a',
    'a[aria-label*="photo" i]',

    // Then fall back to observed structures (more brittle)
    '[data-latest-bg]',
    '.RY3tic',
    '[style*="background-image"]'
];
```

#### 2025 API Restrictions

> **Important:** From March 31, 2025, rclone can only download photos it uploaded.

This affects API-based tools but does **NOT** affect browser-based scraping like giil, which uses the public web interface.

#### Edge Cases

1. **Private albums** — Redirect to login; detect and report
2. **Single photo vs. album** — Different DOM structure
3. **Video content** — Treat as first-class: either
   - **default:** skip with a warning (`"skipped": "video"`) in `--all` mode
   - **opt-in:** `--include-videos` with a separate acquisition pipeline and validation rules

---

### 3. Google Drive (Experimental in v3.0)

#### Overview

Google Drive is the most complex platform due to:
- Strict sharing requirements
- 2024 API changes breaking direct URLs
- Various file types (not just images)

#### Recommendation: Ship Drive as Experimental (v3.0)

To keep v3 compelling and reliable, treat Google Drive support as:

- **v3.0:** public-share only (no login); best-effort; clearly marked `[experimental]` in help/output
- **v3.1+:** optional authenticated mode (opt-in), using a persistent Playwright profile or user-supplied cookies

#### Explicit Non-Goal (v3.0)

giil will **not** attempt to bypass login pages or CAPTCHAs. If the file is restricted, fail with a clear message and remediation steps.

#### URL Formats

```
View URL:       https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
Open URL:       https://drive.google.com/open?id={FILE_ID}
Download URL:   https://drive.google.com/uc?export=download&id={FILE_ID}
Thumbnail URL:  https://drive.google.com/thumbnail?id={FILE_ID}&sz=w{SIZE}
```

#### File ID Extraction

```javascript
function extractGoogleDriveFileId(url) {
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,      // /file/d/{id}/view
        /\/open\?id=([a-zA-Z0-9_-]+)/,       // /open?id={id}
        /[?&]id=([a-zA-Z0-9_-]+)/            // ?id={id} or &id={id}
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}
```

#### Test Results (CRITICAL FINDING)

**The test file was NOT publicly shared.** All methods redirected to Google login:

```
Direct URL tests:
  /uc?export=view     → 303 redirect → accounts.google.com (HTML login page)
  /uc?export=download → 303 redirect → accounts.google.com (HTML login page)
  /thumbnail?sz=w2000 → 200 but returns HTML login page
  /file/d/.../view    → Playwright also redirects to login

Conclusion: File requires "Anyone with the link" sharing permission
```

#### 2024 Direct URL Changes

Google deprecated reliable direct download URLs due to third-party cookie changes:

| Method | Pre-2024 | Post-2024 |
|--------|----------|-----------|
| `/uc?export=view` | ✅ Worked | ❌ Often 403 |
| `/uc?export=download` | ✅ Worked | ❌ Often 403 |
| `/thumbnail?id=&sz=` | ✅ Worked | ⚠️ Lower resolution |

**Source:** [Google Issue Tracker #319531488](https://issuetracker.google.com/issues/319531488)

#### Multi-Tier Capture Strategy

```javascript
async function captureGoogleDrive(page, fileId) {
    // TIER 0: Check if file is public
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
    await page.goto(viewUrl, { waitUntil: 'domcontentloaded' });

    if (page.url().includes('accounts.google.com')) {
        throw new Error('File is not publicly shared. Owner must set sharing to "Anyone with the link".');
    }

    // TIER 1: Try download button
    const downloadBtn = await page.$('[aria-label="Download"]');
    if (downloadBtn) {
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            downloadBtn.click()
        ]);
        if (download) {
            return await download.path();
        }
    }

    // TIER 2: Network interception for lh3 URLs
    // (Images may load from lh3.googleusercontent.com/d/{fileId})

    // TIER 3: Thumbnail URL (may be lower resolution)
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w4000`;
    const response = await page.goto(thumbUrl);
    if (response.ok() && response.headers()['content-type']?.includes('image')) {
        return await response.body();
    }

    // TIER 4: Element screenshot
    const img = await page.$('img[src*="googleusercontent"]');
    if (img) {
        return await img.screenshot({ type: 'png' });
    }

    // TIER 5: Viewport screenshot (last resort)
    return await page.screenshot({ type: 'png' });
}
```

#### Required User Action

For Google Drive to work, the file owner **must**:

1. Right-click the file in Drive
2. Select "Share" → "General access"
3. Change from "Restricted" to "Anyone with the link"
4. Click "Done"

#### Edge Cases

1. **Large files (>100MB)** — Google shows virus scan warning; need to bypass
2. **Google Docs/Sheets** — Not images; detect and skip or convert
3. **Quota exceeded** — Rate limiting; implement backoff
4. **File not found** — Deleted or invalid ID

---

## Technical Architecture

### Platform Adapter Interface (Core Extensibility Primitive)

Each supported platform implements a small adapter surface so the rest of giil remains platform-agnostic:

```typescript
interface PlatformAdapter {
  id: 'icloud' | 'dropbox' | 'gphotos' | 'gdrive';
  match(url: string): boolean;
  normalize(url: string): string;

  // For single-link vs album/folder
  resolveItems(url: string, opts: { all: boolean }): Promise<ResolvedItem[]>;

  // Acquire original bytes (or best available), with provenance
  acquire(item: ResolvedItem, ctx: AcquireContext): Promise<AcquireResult>;
}
```

**AcquireResult** must include:
- `bytes` (or stream), `mime`, `filenameHint`
- `platform`, `method`, `tier`
- `quality` signals (e.g., `width`, `height`, `byteLength`, `isPreview`)

### Strategy Engine (Quality-Aware Fallbacks)

Instead of a hard-coded tier chain that may accidentally return preview assets, giil should:

1. Run a preferred strategy (e.g., direct download URL)
2. **Validate output** (MIME is image, not HTML; size/dimensions exceed minimum; not obviously a preview)
3. If validation fails, automatically try the next strategy

This preserves the simplicity of tiers while preventing "success" from being a low-quality preview.

**Rule:** Any strategy that produces HTML instead of an image is treated as a failure and triggers fallback.

### Proposed Module Structure

```
giil (bash, main script)
├── Platform Detection
│   └── detect_platform(url) → icloud|dropbox|gphotos|gdrive|unknown
│
├── Platform-Specific Handlers (bash)
│   ├── handle_dropbox()     # Direct curl, no browser needed
│   └── normalize_url()      # URL preprocessing per platform
│
└── extractor.mjs (Node.js)
    ├── extractICloud()      # Existing implementation (unchanged)
    ├── extractDropbox()     # Fallback if direct fails
    ├── extractGooglePhotos()
    └── extractGoogleDrive()
```

### Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        URL Input                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ detect_platform()│
                    └──────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌──────────┐          ┌──────────┐
   │ Dropbox │          │  Google  │          │  iCloud/ │
   │         │          │  Photos  │          │  GDrive  │
   └─────────┘          └──────────┘          └──────────┘
        │                     │                     │
        ▼                     │                     │
   ┌─────────┐                │                     │
   │  curl   │                │                     │
   │ direct  │                │                     │
   └─────────┘                │                     │
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────────────────────────────────────────────────────┐
   │                    extractor.mjs                         │
   │               (Playwright if needed)                     │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Image Processing │
                    │  (Sharp/MozJPEG) │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     Output       │
                    │ (file/json/b64)  │
                    └──────────────────┘
```

### Performance Comparison

| Platform | Playwright Required | Expected Time | Resource Usage |
|----------|---------------------|---------------|----------------|
| Dropbox | No | 1-3 seconds | Minimal (curl only) |
| Google Photos | Yes (extraction only) | 5-10 seconds | ~300MB RAM |
| Google Drive | Yes | 5-15 seconds | ~300MB RAM |
| iCloud | Yes | 5-15 seconds | ~300MB RAM |

---

## Implementation Plan

### Phase 1: Dropbox Support (Est. 2-3 hours)

#### Tasks

- [ ] Add URL detection for Dropbox patterns
- [ ] Implement `normalize_dropbox_url()` in bash
- [ ] Add direct download path (skip Playwright entirely)
- [ ] Add Content-Type and magic bytes validation
- [ ] Return clear error if HTML received (password-protected, expired)
- [ ] Update help text and documentation
- [ ] Add tests for Dropbox URLs

> **Note:** Dropbox does NOT use Playwright fallback. If direct download fails (returns HTML/error), fail with a clear message. Users can manually open in browser if needed.

#### Files Modified

```
giil                    # URL detection, Dropbox handler
README.md               # Documentation updates
```

#### Acceptance Criteria

```bash
# These should all work:
giil "https://www.dropbox.com/scl/fi/xxx/photo.png?dl=0"
giil "https://www.dropbox.com/s/xxx/photo.png"
giil "https://www.dropbox.com/scl/fi/xxx/photo.png?rlkey=xxx&dl=0" --json
```

---

### Phase 2: Google Photos Support (Est. 4-6 hours)

#### Tasks

- [ ] Add URL detection for Google Photos patterns
- [ ] Handle `photos.app.goo.gl` → `photos.google.com` redirects
- [ ] Implement CDN URL extraction in extractor.mjs
- [ ] Add `=s0` size modifier for full resolution
- [ ] Add album detection and multi-photo support
- [ ] Update help text and documentation
- [ ] Add tests for Google Photos URLs

#### Files Modified

```
giil                    # URL detection, redirect handling
extractor.mjs           # New extractGooglePhotos() function
README.md               # Documentation updates
```

#### Acceptance Criteria

```bash
# Single photo
giil "https://photos.app.goo.gl/xxx"
giil "https://photos.google.com/share/xxx?key=yyy"

# Album mode
giil "https://photos.app.goo.gl/xxx" --all
```

---

### Phase 3: Google Drive Support (Est. 6-8 hours)

#### Tasks

- [ ] Add URL detection for Google Drive patterns
- [ ] Implement file ID extraction
- [ ] Add authentication detection (redirect to login)
- [ ] Implement multi-tier capture strategy
- [ ] Handle large file virus scan warning
- [ ] Add clear error messages for private files
- [ ] Update help text and documentation
- [ ] Add tests for Google Drive URLs

#### Files Modified

```
giil                    # URL detection, file ID extraction
extractor.mjs           # New extractGoogleDrive() function
README.md               # Documentation updates
```

#### Acceptance Criteria

```bash
# Public file
giil "https://drive.google.com/file/d/xxx/view"

# Private file (should show helpful error)
giil "https://drive.google.com/file/d/private/view"
# Output: Error: File is not publicly shared. The owner must enable "Anyone with the link" access.
```

---

### Phase 4: Documentation & Polish (Est. 2-3 hours)

#### Tasks

- [ ] Rewrite README.md with new branding
- [ ] Add platform-specific troubleshooting sections
- [ ] Update architecture diagrams
- [ ] Add comparison table of platform capabilities
- [ ] Update version to 3.0.0
- [ ] Create migration notes from 2.x

---

## URL Detection Patterns

### Bash Implementation

```bash
detect_platform() {
    local url="$1"

    case "$url" in
        # iCloud
        *share.icloud.com/photos/* | *icloud.com/photos/*)
            echo "icloud"
            ;;

        # Dropbox
        *dropbox.com/s/* | *dropbox.com/scl/fi/* | *dropbox.com/sh/*)
            echo "dropbox"
            ;;

        # Google Photos
        *photos.app.goo.gl/* | *photos.google.com/share/*)
            echo "gphotos"
            ;;

        # Google Drive
        *drive.google.com/file/d/* | *drive.google.com/open?id=* | *docs.google.com/*)
            echo "gdrive"
            ;;

        *)
            echo "unknown"
            ;;
    esac
}
```

### JavaScript Implementation

```javascript
function detectPlatform(url) {
    const patterns = {
        icloud: /(?:share\.)?icloud\.com\/photos/i,
        dropbox: /dropbox\.com\/(?:s|scl\/fi|sh)\//i,
        gphotos: /photos\.(?:app\.goo\.gl|google\.com\/share)/i,
        gdrive: /(?:drive|docs)\.google\.com\/(?:file\/d|open\?id)/i
    };

    for (const [platform, regex] of Object.entries(patterns)) {
        if (regex.test(url)) return platform;
    }
    return 'unknown';
}
```

---

## Capture Strategies by Platform

### Strategy Matrix (Quality-Aware with Validation)

| Platform | Preferred | Fallbacks (quality-aware; auto-validated) |
|----------|-----------|------------------------------------------|
| **iCloud** | Download button | Network CDN → element screenshot → viewport |
| **Dropbox** | Direct URL (`raw=1`) | Browser only for edge UI cases → (otherwise) fail with clear messaging |
| **Google Photos** | Extract base URL + request original (`=s0`) | Alternate extraction signals → element screenshot → viewport |
| **Google Drive** | Public direct download attempt + viewer download | Thumbnail (may be limited) → element screenshot → viewport |

**Rule:** Any strategy that produces HTML instead of an image is treated as a failure and triggers fallback.
**Validation:** Check `Content-Type`, magic bytes, and minimum dimensions before accepting a result.

### CDN Domains by Platform

```javascript
const cdnPatterns = {
    icloud: /cvws\.icloud-content\.com|icloud-content\.com/,
    dropbox: /previews\.dropboxusercontent\.com|dl\.dropboxusercontent\.com/,
    gphotos: /lh3\.googleusercontent\.com\/pw\//,
    gdrive: /lh3\.googleusercontent\.com\/d\/|drive\.google\.com\/thumbnail/
};
```

### Image Element Selectors by Platform

```javascript
const imageSelectors = {
    icloud: [
        'img[src*="cvws.icloud-content"]',
        'img[src*="icloud-content"]',
        '.photo-viewer img'
    ],
    dropbox: [
        'img[src*="previews.dropboxusercontent"]',
        '.preview-container img',
        '[data-testid="preview-image"]'
    ],
    gphotos: [
        '[data-latest-bg]',
        '.RY3tic',
        'img[src*="lh3.googleusercontent"]'
    ],
    gdrive: [
        'img[src*="googleusercontent"]',
        '[data-drive-doc-type="image"] img',
        '.drive-viewer-img'
    ]
};
```

---

## Error Handling

### Platform-Specific Errors

```javascript
const platformErrors = {
    dropbox: {
        404: 'Dropbox link has expired or file was deleted',
        403: 'This Dropbox file requires a password or additional permissions',
        429: 'Too many requests to Dropbox. Please wait and try again.'
    },
    gphotos: {
        auth_redirect: 'This Google Photos album is private. Only public shares are supported.',
        no_photos: 'No photos found in this album. It may be empty or restricted.'
    },
    gdrive: {
        auth_redirect: 'This file is not publicly shared. The owner must set sharing to "Anyone with the link".',
        virus_scan: 'Google cannot scan this file for viruses. Attempting alternative download...',
        quota: 'Download quota exceeded. Please try again later.'
    }
};
```

### User-Friendly Messages

```bash
# Example error output for Google Drive private file
[giil] Error: Google Drive file is not publicly shared
[giil]
[giil] The file owner must:
[giil]   1. Right-click the file in Google Drive
[giil]   2. Click "Share" → "General access"
[giil]   3. Change "Restricted" to "Anyone with the link"
[giil]   4. Click "Done"
[giil]
[giil] Then try again with the same URL.
```

### Exit Codes (Standardized for Scripting)

To support scripting and AI toolchains, standardize exit codes:

| Exit Code | Meaning | Description |
|-----------|---------|-------------|
| `0` | Success | Image captured and saved/output |
| `1` | Capture failure | All capture strategies failed (page loaded but no image obtained) |
| `2` | Usage error | Bad CLI options, missing URL, invalid arguments |
| `10` | Network error | Timeout, DNS failure, unreachable (retryable) |
| `11` | Auth required | Restricted share, login required, password protected |
| `12` | Not found | Expired link, deleted file, invalid ID |
| `13` | Unsupported type | Not an image, video file, Google Doc |
| `20` | Internal error | Unexpected failure, bug in giil |

### JSON Error Schema (v3)

When `--json` is used, errors should be structured for programmatic handling:

```json
{
  "schema_version": "1",
  "ok": false,
  "platform": "gdrive",
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "File is not publicly shared.",
    "remediation": "The owner must set sharing to 'Anyone with the link'."
  }
}
```

Error codes map to exit codes:
- `CAPTURE_FAILURE` → exit 1
- `USAGE_ERROR` → exit 2
- `NETWORK_ERROR` → exit 10
- `AUTH_REQUIRED` → exit 11
- `NOT_FOUND` → exit 12
- `UNSUPPORTED_TYPE` → exit 13
- `INTERNAL_ERROR` → exit 20

### Debug/Trace Artifacts (Opt-in)

Add flags to improve bug reports and reduce local debugging time:

- `--debug-dir <path>`: write HTML/screenshots/HAR/trace to a specific directory
- `--trace`: enable Playwright tracing (screenshots + DOM snapshots) for the run
- `--log-format text|json`: allow structured logs for CI/tooling

---

## Testing Strategy

### Testing Layers (Recommended)

Testing should be split into three layers to balance reliability with coverage:

1. **Unit tests (always in CI):**
   - Platform detection + normalization
   - File ID extraction
   - Output schema validation
   - URL transformation logic

2. **Replay tests (always in CI, deterministic):**
   - Use recorded HAR/fixtures to validate extraction logic without hitting real services
   - Playwright can replay network responses from saved HAR files
   - Provides consistent, fast, offline-capable testing

3. **Live contract tests (optional / scheduled):**
   - Run against real public test shares
   - Gated behind `LIVE_TESTS=1` env var or scheduled workflow (e.g., nightly)
   - Catches platform changes but accepts occasional flakiness

### Unit Test URLs (Live Tests Only)

```bash
# Test files (create public test files for CI)
DROPBOX_TEST="https://www.dropbox.com/scl/fi/test123/test.png?dl=0"
GPHOTOS_TEST="https://photos.app.goo.gl/testalbum123"
GDRIVE_TEST="https://drive.google.com/file/d/test123/view"
```

### CI Test Matrix

```yaml
# .github/workflows/ci.yml additions
jobs:
  test-platforms:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform: [icloud, dropbox, gphotos, gdrive]
    steps:
      - name: Run unit + replay tests (always)
        run: npm test

      - name: Run live tests (optional)
        if: ${{ env.LIVE_TESTS == '1' }}
        run: |
          ./giil "${{ env[format('{0}_TEST_URL', matrix.platform)] }}" --json
```

### Expected Outputs

```json
// Dropbox
{"schema_version": "1", "ok": true, "path": "/tmp/dropbox_20260103_142136.jpg", "method": "direct", "platform": "dropbox"}

// Google Photos
{"schema_version": "1", "ok": true, "path": "/tmp/gphotos_20260103_142245.jpg", "method": "url-extraction", "platform": "gphotos"}

// Google Drive
{"schema_version": "1", "ok": true, "path": "/tmp/gdrive_20260103_142312.jpg", "method": "download", "platform": "gdrive"}

// Album mode (JSONL; one line per item)
{"schema_version": "1", "ok": true, "platform": "gphotos", "method": "url-extraction", "item_index": 1, "path": "/tmp/album/001.png"}
{"schema_version": "1", "ok": true, "platform": "gphotos", "method": "url-extraction", "item_index": 2, "path": "/tmp/album/002.png"}
```

---

## Migration & Backwards Compatibility

### Version Bump

```
Current:  2.1.0
Target:   3.0.0 (major version for expanded scope)
```

### Backwards Compatibility

All existing iCloud functionality remains unchanged:

```bash
# These continue to work exactly as before
giil "https://share.icloud.com/photos/xxx"
giil "https://www.icloud.com/photos/#xxx"
giil "https://share.icloud.com/photos/xxx" --all
giil "https://share.icloud.com/photos/xxx" --json --base64
```

### New JSON Schema (v3)

Add `schema_version`, `ok`, and `platform` fields to JSON output:

```json
{
  "schema_version": "1",
  "ok": true,
  "path": "/path/to/file.jpg",
  "platform": "dropbox",
  "method": "direct",
  "datetime": "2026-01-03T14:32:45.000Z",
  ...
}
```

**Why `schema_version`?** Adding new fields is technically a breaking change for parsers expecting exact schema. The `schema_version` field allows consumers to detect and handle schema changes gracefully.

### Output Processing Defaults (v3 Behavior Change)

- **Default:** Preserve best-available original bytes (format + resolution) when possible
- **Opt-in:** `--convert <format>` / `--optimize` enables re-encoding/compression
- **Rationale:** Avoids silent quality loss (especially for UI screenshots) and improves performance

This is a **behavior change** from v2 where MozJPEG compression was applied by default.

### New Utility Commands

- `giil cache clean` — Purge cached data and browser binaries
- `giil doctor` — Check runtime deps and print actionable remediation

---

## Future Platforms

### Potential Additions (v3.1+)

| Platform | Feasibility | Notes |
|----------|-------------|-------|
| **OneDrive** | Medium | Similar to Google Drive challenges |
| **Imgur** | Easy | Direct URLs available |
| **Flickr** | Medium | API changes frequently |
| **Box** | Medium | Enterprise focus, may require auth |
| **AWS S3** | Easy | If presigned URLs provided |
| **Cloudinary** | Easy | Transformation URLs predictable |

### Platform Request Template

```markdown
## Platform Request: [Name]

### URL Examples
-

### Direct Download Available?
- [ ] Yes, with URL manipulation
- [ ] No, requires browser

### Authentication Required?
- [ ] Never (public shares work)
- [ ] Sometimes (depends on share settings)
- [ ] Always (API key required)

### Album/Folder Support?
- [ ] Yes
- [ ] No

### Notes
```

---

## Appendix: Research Data

### Raw Test Results

#### Dropbox

```
Direct URL (raw=1):
  curl command: curl -sL "...&raw=1" -o /tmp/dropbox.png
  HTTP Status:  200
  Content-Type: image/png
  Resolution:   2760×2288
  File size:    2,381,863 bytes (2.27 MB)
  Status:       ✅ Full resolution, no browser needed

Playwright network capture:
  CDN domain:   previews.dropboxusercontent.com
  Resolution:   1600×1326
  File size:    1,356,897 bytes (1.29 MB)
  Status:       ⚠️ Preview resolution only
```

#### Google Photos

```
URL extraction + =s0:
  Base URL:     https://lh3.googleusercontent.com/pw/AP1GczNX...
  Full URL:     {base}=s0
  HTTP Status:  200
  Content-Type: image/png
  Resolution:   2760×2288
  File size:    2,244,002 bytes (2.14 MB)
  Status:       ✅ Full resolution

Playwright network capture:
  Captured URL: {base}=w1042-h862-no
  Resolution:   1040×862
  File size:    639,058 bytes (624 KB)
  Status:       ⚠️ Preview resolution only

Size modifier tests:
  =w1042-h862-no → 1040×862 (preview)
  =w0            → 2760×2288 (full)
  =s0            → 2760×2288 (full)
  =w4000         → 2760×2288 (capped at original)
```

#### Google Drive

```
Status: ❌ Test file not publicly shared

All methods returned HTML (login page):
  - /uc?export=view        → 303 redirect to accounts.google.com
  - /uc?export=download    → 303 redirect to accounts.google.com
  - /thumbnail?id=&sz=w2000 → 200 but HTML content
  - /file/d/.../view        → Playwright redirects to login

Note: Requires "Anyone with the link" sharing permission to function
```

### Relevant Sources

- [Dropbox: Force Download](https://help.dropbox.com/share/force-download)
- [Google Issue Tracker #319531488](https://issuetracker.google.com/issues/319531488) (Drive /uc deprecation)
- [rclone Google Photos](https://rclone.org/googlephotos/) (2025 API restrictions)
- [scrape-google-photos](https://github.com/alexcrist/scrape-google-photos)
- [Google Drive Direct Links Guide](https://getlate.dev/blog/google-drive-direct-download-urls-complete-guide)

---

## Open Questions for Review (With Recommended Postures)

1. **Google Drive priority:** Given its complexity and conditional success, should Google Drive be deprioritized or implemented with clear "experimental" warnings?

   **Recommendation:** Yes, **deprioritize and ship as experimental**. Make v3's headline value be Dropbox + Google Photos + iCloud (all high-signal, high-success). Drive support should not be allowed to define perceived reliability. Mark it `[experimental]` in help output.

2. **Album detection heuristics:** The thumbnail selectors discovered (`.RY3tic`, `[data-latest-bg]`) are class names that could change. Should we implement more robust detection?

   **Recommendation:** Yes, implement **multi-signal extraction** and prefer semantic selectors/locators. Keep brittle class names only as a last fallback, and protect with validation + retries. This is already reflected in the updated plan.

3. **Error message verbosity:** Should error messages include the full remediation steps (as shown), or should they link to documentation instead?

   **Recommendation:** Default to concise errors with `--verbose` or `--explain` to print step-by-step remediation. This keeps normal output clean while preserving great UX when needed.

4. **Platform field in JSON:** Adding `platform` to JSON output is technically a breaking change for parsers expecting exact schema. Is semver 3.0.0 sufficient, or do we need a deprecation period?

   **Recommendation:** Semver 3.0 is fine, but add `schema_version` and `ok` so future additions don't keep breaking consumers. This is now reflected in the plan's JSON schema section.

5. **Direct download timeout:** For Dropbox's curl-based approach, what timeout should we use? The current Playwright timeout is 60 seconds, but curl could be faster or slower depending on file size.

   **Recommendation:** Set **connect timeout** low (e.g., 10s) and **overall timeout** moderate (e.g., 5-10 minutes), plus retries on transient errors, and show progress if interactive. More important than exact numbers: make them configurable (`--timeout`, `--connect-timeout`).

---

## Additional Recommendations (Meta)

Based on external review, consider these enhancements:

- **`--print-url`**: Output the final resolved *direct* URL when available (Dropbox raw, Google Photos `=s0`). Useful for debugging and integrating with other tools.
- **`--output -`**: Stream raw bytes to stdout for piping (e.g., into an AI tool, image viewer, or hash function).
- **`--filename-template`**: Support template-based naming for albums (`{platform}/{date}_{index}_{id}.{ext}`).
- **`--max-bytes` safety limit**: Prevent accidental multi-GB downloads when the link is wrong or points to a ZIP.
- **`--jobs N` and `--resume`**: For album downloads, support parallel downloads and resume from interrupted runs.

---

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-03 | Claude | Initial research and plan creation |
| 2026-01-03 | Claude | Revised for self-contained review (added background, architecture, methodology) |
| 2026-01-03 | Claude | Major revision based on external LLM review: added goals/non-goals, security posture, platform adapter interface, quality-aware fallbacks, exit codes, schema versioning, testing layers, and platform-specific robustness improvements |

---

*This document is intended for technical review and will be updated as implementation progresses.*
