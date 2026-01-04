<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-blue?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blueviolet?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/runtime-Node.js%2018+-purple?style=for-the-badge" alt="Runtime" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
</p>

<h1 align="center">giil</h1>
<h3 align="center">Get iCloud Image Link</h3>

<p align="center">
  <strong>A zero-setup CLI that downloads full-resolution images from iCloud photo shares</strong>
</p>

<p align="center">
  The missing link between your iPhone screenshots and remote AI coding sessions.<br/>
  Share an image via iCloud, paste the link into your SSH terminal, and your AI assistant can see it instantly.
</p>

<p align="center">
  <em>Single-file bash script with embedded Node.js extractor. Auto-installs all dependencies.<br/>
  Supports single photos, entire albums, JSON metadata output, and base64 encoding.</em>
</p>

---

<p align="center">

```bash
curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/get_icloud_image_link/main/install.sh?v=3.0.0" | bash
```

</p>

---

## 🎯 The Primary Use Case: Remote AI-Assisted Debugging

**The scenario:** You're SSH'd into a remote server running Claude Code, Codex, or another AI coding assistant. You need to debug a UI issue on your iPhone, but how do you get that screenshot to your remote terminal session?

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   iPhone    │────▶│  iCloud     │────▶│  Photos.app │────▶│  Share Link │
│ Screenshot  │     │   Sync      │     │   (Mac)     │     │   (Copy)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Agent   │◀────│    giil     │◀────│   Paste     │◀────│ Remote SSH  │
│  Analyzes   │     │  Downloads  │     │   URL       │     │  Terminal   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**The workflow:**

1. **Screenshot** the UI bug on your iPhone
2. **Wait a moment** for iCloud to sync to your Mac
3. **Right-click** the image in Photos.app → Share → Copy iCloud Link
4. **Paste** the link into your remote terminal session
5. **Run giil** and the image is now local to your remote machine

```bash
# On your remote server (SSH session with Claude Code/Codex)
giil "https://share.icloud.com/photos/0a1Abc_xYz..." --json

# AI assistant can now analyze the screenshot directly
# {"path": "/tmp/icloud_20240115_143022.jpg", "width": 1170, "height": 2532, ...}
```

**Comparison:**

| Without giil | With giil |
|--------------|-----------|
| Download image locally, SCP to server, tell AI the path | One command, AI sees it instantly |
| Email yourself, download on server, hope it works | Paste link, done |
| Set up complex file sync between devices | Just use iCloud's built-in sharing |
| Break your flow to context-switch between devices | Stay in your terminal |

This bridges your Apple devices and remote AI coding sessions. No file transfers, no context switching, no friction.

---

## Table of Contents

- [The Primary Use Case](#-the-primary-use-case-remote-ai-assisted-debugging)
- [Why giil Exists](#-why-giil-exists)
- [Highlights](#-highlights)
- [Quickstart](#-quickstart)
- [Usage](#-usage)
  - [Options](#options)
  - [Supported Platforms](#supported-platforms)
- [Output Modes](#-output-modes)
- [Album Mode](#-album-mode)
- [How It Works](#-how-it-works)
- [Capture Strategies in Detail](#-capture-strategies-in-detail)
- [Platform-Specific Optimizations](#-platform-specific-optimizations)
- [Image Processing Pipeline](#-image-processing-pipeline)
- [Download Verification](#-download-verification)
- [Design Principles](#-design-principles)
- [Architecture](#-architecture)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [File Locations](#-file-locations)
- [Performance](#-performance)
- [Troubleshooting](#-troubleshooting)
- [Exit Codes](#-exit-codes)
- [Terminal Styling](#-terminal-styling)
- [Environment Variables](#-environment-variables)
- [Dependencies](#-dependencies)
- [Security & Privacy](#-security--privacy)
- [Uninstallation](#-uninstallation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 💡 Why giil Exists

Cloud photo sharing services present unique challenges for automation:

| Problem | Why It's Hard | How giil Solves It |
|---------|---------------|-------------------|
| **JavaScript-heavy SPAs** | Standard `curl`/`wget` can't execute JS or render pages | Headless Chromium via Playwright (or direct download for Dropbox) |
| **Dynamic image loading** | Images load asynchronously from CDN after page render | Network interception captures CDN responses |
| **No direct download links** | URLs are session-specific and expire quickly | Clicks native Download button or intercepts live requests |
| **Copy/paste loses quality** | Manual screenshots result in compressed/cropped images | Captures original resolution from source |
| **HEIC format on Apple devices** | Many tools can't process Apple's HEIC/HEIF format | Platform-aware conversion (sips/heif-convert) |
| **Platform fragmentation** | Each service has different URL patterns and APIs | Automatic platform detection with optimized strategies |

giil lets you programmatically download full-resolution images from iCloud, Dropbox, Google Photos, and Google Drive share links—which is otherwise impossible without manual browser interaction.

**Typical workflow:** Debugging a UI issue with Claude Code or Codex on a remote server? Screenshot on iPhone → iCloud syncs → Share link from Photos.app → Paste into SSH terminal → `giil` fetches it → AI analyzes the image. No SCP, no email, no friction.

---

## ✨ Highlights

<table>
<tr>
<td width="50%">

### Zero-Setup Installation
One-liner installer handles everything:
- Node.js detection/installation
- Playwright + Chromium (~200MB, cached)
- Sharp image processing library
- Optional gum for beautiful CLI output

</td>
<td width="50%">

### Four-Tier Capture Strategy
Maximum reliability through intelligent fallbacks:
1. **Download button** → Original file
2. **CDN interception** → Full resolution
3. **Element screenshot** → Rendered image
4. **Viewport screenshot** → Last resort

</td>
</tr>
<tr>
<td width="50%">

### Album Support
Download entire shared albums with `--all`:
- Automatic thumbnail detection
- Sequential full-resolution capture
- Collision-free filenames with indices
- Continues on individual failures

</td>
<td width="50%">

### Flexible Output
Multiple output modes for any workflow:
- **File path** → Default, for scripting
- **JSON metadata** → Path, datetime, dimensions
- **Base64** → Embedding, piping, APIs
- **Album mode** → One output per photo

</td>
</tr>
<tr>
<td width="50%">

### Smart Filenames
EXIF-aware datetime stamping:
- Extracts `DateTimeOriginal` from EXIF
- Falls back to capture timestamp
- Format: `icloud_YYYYMMDD_HHMMSS.jpg`
- Automatic collision avoidance

</td>
<td width="50%">

### Image Processing
MozJPEG compression by default:
- Optimal size/quality balance
- `--preserve` to keep original bytes
- `--convert` for format conversion
- HEIC auto-conversion supported

</td>
</tr>
</table>

---

## ⚡ Quickstart

### Installation

**One-liner (recommended):**
```bash
curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/get_icloud_image_link/main/install.sh?v=3.0.0" | bash
```

<details>
<summary><strong>Manual installation</strong></summary>

```bash
# Download script
curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/get_icloud_image_link/main/giil -o ~/.local/bin/giil
chmod +x ~/.local/bin/giil

# Ensure ~/.local/bin is in PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc
```

</details>

<details>
<summary><strong>Installation options</strong></summary>

```bash
# Custom install directory
DEST=/opt/bin curl -fsSL .../install.sh | bash

# System-wide installation (requires sudo)
GIIL_SYSTEM=1 curl -fsSL .../install.sh | bash

# Skip PATH modification
GIIL_NO_ALIAS=1 curl -fsSL .../install.sh | bash
```

</details>

### First Run

```bash
giil "https://share.icloud.com/photos/02cD9okNHvVd-uuDnPCH3ZEEA"
```

> **Note:** First run downloads Playwright Chromium (~200MB). This is cached for future runs in `~/.cache/giil/`.

---

## 🚀 Usage

```
giil <icloud-photo-url> [options]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--output DIR` | `.` | Output directory for saved images |
| `--preserve` | off | Preserve original bytes (skip MozJPEG compression) |
| `--convert FMT` | — | Convert to format: `jpeg`, `png`, `webp` |
| `--quality N` | `85` | JPEG quality 1-100 |
| `--base64` | off | Output base64 to stdout instead of saving file |
| `--json` | off | Output JSON metadata (path, datetime, dimensions, method) |
| `--all` | off | Download all photos from a shared album |
| `--timeout N` | `60` | Page load timeout in seconds |
| `--debug` | off | Save debug artifacts (screenshot + HTML) on failure |
| `--verbose` | off | Show detailed progress (implies `--debug`) |
| `--trace` | off | Enable Playwright tracing for deep debugging |
| `--print-url` | off | Output resolved direct URL instead of downloading |
| `--debug-dir DIR` | `.` | Directory for debug artifacts |
| `--update` | off | Force reinstall of Playwright and dependencies |
| `--version` | — | Print version and exit |
| `--help` | — | Show help message |

> **Default Behavior:** Images are compressed with MozJPEG for optimal size/quality balance.
> Use `--preserve` to keep original bytes without recompression.

### Supported Platforms

giil automatically detects the sharing platform and uses the optimal download strategy:

| Platform | URL Patterns | Method | Browser Required |
|----------|--------------|--------|------------------|
| **iCloud** | `share.icloud.com/photos/*`<br>`icloud.com/photos/#*` | 4-tier capture strategy | Yes |
| **Dropbox** | `dropbox.com/s/*`<br>`dropbox.com/scl/fi/*` | Direct curl download (`raw=1`) | **No** |
| **Google Photos** | `photos.app.goo.gl/*`<br>`photos.google.com/share/*` | URL extraction + `=s0` modifier | Yes |
| **Google Drive** | `drive.google.com/file/d/*`<br>`drive.google.com/open?id=*` | Multi-tier with auth detection | Yes |

**Dropbox Fast Path:** Dropbox links are downloaded directly via `curl` with no browser overhead—typically completes in under 2 seconds.

**Google Photos Full-Resolution:** giil automatically appends `=s0` to CDN URLs to request maximum resolution (the `s0` modifier bypasses size restrictions).

### Supported URL Formats

**iCloud** (both formats automatically normalized):
```
https://share.icloud.com/photos/02cD9okNHvVd-uuDnPCH3ZEEA
https://www.icloud.com/photos/#02cD9okNHvVd-uuDnPCH3ZEEA
```

**Dropbox:**
```
https://www.dropbox.com/s/abc123/photo.jpg
https://www.dropbox.com/scl/fi/xyz789/image.png
```

**Google Photos:**
```
https://photos.app.goo.gl/abc123xyz
https://photos.google.com/share/AF1QipN...
```

**Google Drive:**
```
https://drive.google.com/file/d/1ABC.../view
https://drive.google.com/open?id=1ABC...
```

---

## 📤 Output Modes

### Default: File Path

Returns the absolute path to the saved image on stdout.

```bash
giil "https://share.icloud.com/photos/XXX"
# stdout: /current/dir/icloud_20240115_143245.jpg
# stderr: [giil] Saved: /current/dir/icloud_20240115_143245.jpg (234.5 KB, network)
```

**Use in scripts:**
```bash
IMAGE_PATH=$(giil "https://share.icloud.com/photos/XXX" --output ~/Downloads 2>/dev/null)
echo "Downloaded: $IMAGE_PATH"
```

### JSON Mode: `--json`

Returns structured metadata for programmatic use. The JSON schema includes metadata for reliable scripting.

```bash
giil "https://share.icloud.com/photos/XXX" --json
```

**Success response:**
```json
{
  "ok": true,
  "schema_version": "1",
  "platform": "icloud",
  "path": "/absolute/path/to/icloud_20240115_143245.jpg",
  "datetime": "2024-01-15T14:32:45.000Z",
  "sourceUrl": "https://cvws.icloud-content.com/...",
  "method": "network",
  "size": 245678,
  "width": 4032,
  "height": 3024
}
```

**Error response:**
```json
{
  "ok": false,
  "schema_version": "1",
  "platform": "icloud",
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Login required - link is not publicly shared",
    "remediation": "The file is not publicly shared. The owner must enable public access."
  }
}
```

| Field | Description |
|-------|-------------|
| `ok` | Boolean success indicator (`true` or `false`) |
| `schema_version` | JSON schema version (currently `"1"`) |
| `platform` | Detected platform: `icloud`, `dropbox`, `gphotos`, `gdrive` |
| `path` | Absolute path to saved file |
| `datetime` | ISO 8601 timestamp (from EXIF or capture time) |
| `sourceUrl` | CDN URL where image was obtained |
| `method` | Capture strategy: `download`, `network`, `element-screenshot`, `viewport-screenshot`, `direct` |
| `size` | File size in bytes |
| `width` | Image width in pixels |
| `height` | Image height in pixels |
| `error.code` | Error code (see [Exit Codes](#-exit-codes)) |
| `error.message` | Human-readable error description |
| `error.remediation` | Suggested fix for the error |

**Parse with jq:**
```bash
# Get path (if successful)
giil "https://share.icloud.com/photos/XXX" --json | jq -r 'if .ok then .path else .error.message end'

# Check success
giil "..." --json | jq -e '.ok' && echo "Success" || echo "Failed"
```

### Base64 Mode: `--base64`

Outputs the image as a base64-encoded string (no file saved).

```bash
# Decode to file
giil "https://share.icloud.com/photos/XXX" --base64 | base64 -d > image.jpg

# Create data URI
echo "data:image/jpeg;base64,$(giil '...' --base64)" > uri.txt

# Pipe to API
giil "https://share.icloud.com/photos/XXX" --base64 | \
  curl -X POST -d @- https://api.example.com/upload
```

**Combined with JSON:**
```bash
giil "https://share.icloud.com/photos/XXX" --base64 --json
```
```json
{
  "base64": "/9j/4AAQSkZJRg...",
  "datetime": "2024-01-15T14:32:45.000Z",
  "method": "network"
}
```

---

## 📚 Album Mode

Download every photo from a shared iCloud album with `--all`.

```bash
giil "https://share.icloud.com/photos/XXX" --all --output ~/album
```

### How Album Mode Works

```
1. Load album page
2. Detect thumbnail grid (11 selector strategies)
3. For each thumbnail:
   a. Click to open full-size view
   b. Wait for image to load
   c. Capture using 4-tier strategy
   d. Process and save with index suffix
   e. Close viewer (button or Escape key)
   f. Continue to next thumbnail
4. Output one path/JSON per photo
```

### Album Output

**Default output:**
```
/path/to/album/icloud_20240115_143245_001.jpg
/path/to/album/icloud_20240115_143246_002.jpg
/path/to/album/icloud_20240115_143247_003.jpg
```

**With `--json`:**
```json
{"path": "...001.jpg", "method": "download", "width": 4032, ...}
{"path": "...002.jpg", "method": "network", "width": 3024, ...}
{"path": "...003.jpg", "method": "network", "width": 4032, ...}
```

### Album Mode Features

- **Resilient:** Continues to next photo if one fails
- **Indexed filenames:** `_001`, `_002`, etc. for ordering
- **Collision-free:** Appends counter if filename exists
- **Progress feedback:** Shows `Photo 1/N...` on stderr

### Rate Limiting & Polite Downloading

Album mode implements respectful rate limiting to avoid overwhelming cloud services:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Photo 1    │────▶│   1 second  │────▶│  Photo 2    │────▶ ...
│  Download   │     │    delay    │     │  Download   │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Fixed delays:**
- **1 second** between album photos — Prevents overwhelming iCloud servers
- Applies after each successful or failed download

**Exponential backoff:**
- If the server returns rate-limiting signals, giil backs off exponentially
- Base multiplier of **2** (1s → 2s → 4s → 8s → ...)
- Automatic retry with increasing delays

**Why this matters:**
- Reduces risk of IP-based rate limiting or temporary bans
- Prevents triggering anti-abuse measures
- Allows iCloud to serve other users fairly
- Improves overall reliability of large album downloads

---

## 🔬 How It Works

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Input    │────▶│   Bash Wrapper   │────▶│  Node.js Core   │
│  (URL + flags)  │     │  (giil script)   │     │ (extractor.mjs) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌──────────────┐         ┌──────────────┐
                        │  Dependency  │         │  Playwright  │
                        │  Management  │         │  (Chromium)  │
                        └──────────────┘         └──────────────┘
                                                        │
                               ┌────────────────────────┼────────────────────────┐
                               ▼                        ▼                        ▼
                        ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                        │   Network    │         │   Download   │         │  Screenshot  │
                        │ Interception │         │    Button    │         │   Fallback   │
                        └──────────────┘         └──────────────┘         └──────────────┘
                               │                        │                        │
                               └────────────────────────┼────────────────────────┘
                                                        ▼
                                                 ┌──────────────┐
                                                 │    Sharp     │
                                                 │  Processing  │
                                                 └──────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │    Output    │
                                                 │ (file/json/  │
                                                 │   base64)    │
                                                 └──────────────┘
```

### Step-by-Step Process

1. **URL Normalization**
   - Converts `share.icloud.com/photos/XXX` to `www.icloud.com/photos/#XXX`
   - Both formats load the same iCloud photo viewer

2. **Dependency Bootstrap**
   - Checks for Node.js ≥18 (installs if missing)
   - Ensures Playwright + Chromium in cache
   - Generates `extractor.mjs` from embedded template

3. **Browser Launch**
   - Spawns headless Chromium via Playwright
   - Sets realistic viewport (1920×1080) and user-agent
   - Enables download interception

4. **Page Navigation**
   - Loads iCloud URL with configurable timeout
   - Auto-dismisses cookie banners and overlays
   - Waits for network idle state

5. **Image Capture**
   - Executes 4-tier fallback strategy (see below)
   - Selects highest-quality capture method that succeeds

6. **Image Processing**
   - Extracts EXIF datetime for filename
   - Converts HEIC/HEIF if necessary
   - Compresses with MozJPEG (or `--preserve` to keep original bytes)

7. **Output Generation**
   - Writes file to disk (or base64 to stdout)
   - Returns path/JSON on stdout

---

## 🎯 Capture Strategies in Detail

giil implements a **four-tier fallback strategy** to maximize reliability across different iCloud page states and configurations.

### Strategy 1: Download Button (Highest Quality)

```javascript
// Selectors tried in order:
'button[aria-label="Download"]'
'button[title="Download"]'
'a[aria-label="Download"]'
'[data-testid*="download"]'
'button:has-text("Download")'
'.download-button'
'[class*="download"]'
```

**How it works:**
1. Locate visible Download button using selector cascade
2. Click and wait for browser download event
3. Save to temporary file, read into memory
4. Clean up temp file after processing

**Advantages:**
- Obtains **original file** (no re-encoding losses)
- Works with HEIC/HEIF originals
- Highest possible quality

**When it fails:**
- Download button not visible or doesn't exist
- Click doesn't trigger download event within 10s

### Strategy 2: Network Interception (Full Resolution)

```javascript
// CDN detection:
url.includes('cvws.icloud-content.com') ||
url.includes('icloud-content.com')

// Content-type filtering:
'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'
```

**How it works:**
1. Install response handler **before** page navigation
2. Monitor all HTTP responses for iCloud CDN patterns
3. Capture image buffers, keep largest (>10KB threshold)
4. Use captured buffer if download button fails

**Advantages:**
- Captures full-resolution CDN images
- No screenshot quality loss
- Works even if UI elements are obscured

**When it fails:**
- CDN domain structure changes
- Image loads before handler installed
- All captured images below size threshold

### Strategy 3: Element Screenshot

```javascript
// Selectors tried in order:
'img[src*="cvws.icloud-content"]'
'img[src*="icloud-content"]'
'.photo-viewer img'
'.media-viewer img'
'[data-testid="photo"] img'
'main img'
'picture img'
'[role="img"]'
```

**How it works:**
1. Query for image elements using selector cascade
2. Verify element is visible and ≥100×100 pixels
3. Take PNG screenshot of the element
4. Convert to JPEG during processing

**Advantages:**
- Captures rendered image as displayed
- Works when network capture misses

**When it fails:**
- No matching visible image element
- Element too small (<100px)

### Strategy 4: Viewport Screenshot (Last Resort)

```javascript
await page.screenshot({ type: 'png', fullPage: false });
```

**How it works:**
1. Capture visible viewport (1920×1080)
2. Include entire visible area
3. Convert to JPEG during processing

**Advantages:**
- Always succeeds if page loads
- Useful for debugging page state

**Limitations:**
- May include UI chrome
- Quality depends on viewport size
- Not ideal for production use

### Strategy Selection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Start Capture                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Try Download Button │
                   │    (9 selectors)    │
                   └─────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 Success              Fail
                    │                   │
                    ▼                   ▼
              ┌──────────┐    ┌─────────────────────┐
              │  Done!   │    │ Check CDN Capture   │
              │ (method: │    │   (buffer >10KB?)   │
              │ download)│    └─────────────────────┘
              └──────────┘              │
                              ┌─────────┴─────────┐
                              │                   │
                           Success              Fail
                              │                   │
                              ▼                   ▼
                        ┌──────────┐    ┌─────────────────────┐
                        │  Done!   │    │ Try Element Screenshot│
                        │ (method: │    │    (10 selectors)    │
                        │ network) │    └─────────────────────┘
                        └──────────┘              │
                                        ┌─────────┴─────────┐
                                        │                   │
                                     Success              Fail
                                        │                   │
                                        ▼                   ▼
                                  ┌──────────┐    ┌─────────────────────┐
                                  │  Done!   │    │ Viewport Screenshot │
                                  │ (method: │    │   (always works)    │
                                  │ element- │    └─────────────────────┘
                                  │screenshot│              │
                                  └──────────┘              ▼
                                                      ┌──────────┐
                                                      │  Done!   │
                                                      │ (method: │
                                                      │ viewport-│
                                                      │screenshot│
                                                      └──────────┘
```

---

## 🔌 Platform-Specific Optimizations

Each supported platform has custom handling for optimal results:

### iCloud

- **4-tier capture strategy** as described above
- Cookie banner auto-dismissal
- Album detection and iteration
- HEIC/HEIF format handling

### Dropbox

Dropbox provides a fast path that bypasses Playwright entirely:

```bash
# URL transformation:
https://www.dropbox.com/s/abc123/photo.jpg?dl=0
→ https://www.dropbox.com/s/abc123/photo.jpg?raw=1
```

- Direct `curl` download (no browser overhead)
- Typically completes in **1-2 seconds**
- Full original quality preserved
- Works with any Dropbox shared link format

### Google Photos

Google Photos uses URL modifiers for resolution control:

```
Original CDN URL:
https://lh3.googleusercontent.com/pw/xxx=w1920-h1080

Full-resolution URL (giil applies =s0):
https://lh3.googleusercontent.com/pw/xxx=s0
```

- `=s0` modifier requests maximum resolution
- Network interception captures all CDN responses
- Collects unique base URLs for album mode
- Automatic full-res download attempt

### Google Drive

Multi-tier approach with authentication detection:

1. **Direct download URL** (`/uc?export=download`)
2. **Thumbnail extraction** (high-res `sz=w4000`)
3. **Screenshot fallback**

**Auth detection:** If the file requires login, giil detects the redirect and returns a meaningful error (`AUTH_REQUIRED`) instead of capturing a login page.

---

## 🖼️ Image Processing Pipeline

### Processing Stages

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Raw       │────▶│    EXIF     │────▶│    HEIC     │────▶│   Sharp     │
│   Buffer    │     │  Datetime   │     │ Conversion  │     │   JPEG      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                    ┌─────────────┐     ┌─────────────┐            │
                    │   Output    │◀────│  Filename   │◀───────────┘
                    │   Result    │     │ Generation  │
                    └─────────────┘     └─────────────┘
```

### EXIF Datetime Extraction

Using the `exifr` library, giil extracts datetime metadata to create meaningful filenames:

```javascript
// Priority order:
1. DateTimeOriginal  // When photo was taken (most reliable)
2. CreateDate        // File creation time
3. DateTimeDigitized // When digitized
4. ModifyDate        // Last modification
5. Current time      // Fallback if no EXIF
```

### HEIC/HEIF Conversion

Apple devices often produce HEIC images. giil handles this with platform-aware tools:

| Platform | Tool | Notes |
|----------|------|-------|
| macOS | `sips` | Built-in, always available |
| Linux | `heif-convert` | Requires `libheif-examples` package |

```bash
# Install HEIC support on Linux:
sudo apt-get install libheif-examples  # Debian/Ubuntu
sudo dnf install libheif-tools         # Fedora
```

### MozJPEG Compression (Default)

By default, giil compresses images with MozJPEG for optimal size/quality balance:

```bash
# MozJPEG compression (default)
giil "https://share.icloud.com/photos/..."

# Preserve original bytes (skip compression)
giil "https://share.icloud.com/photos/..." --preserve

# Convert to WebP format
giil "https://share.icloud.com/photos/..." --convert webp
```

Sharp applies MozJPEG compression:

```javascript
sharp(buffer).jpeg({
  quality: 85,           // Configurable via --quality
  mozjpeg: true,         // Enable MozJPEG optimizer
  chromaSubsampling: '4:2:0'  // Standard JPEG subsampling
})
```

**Compression characteristics:**
- **40-50% smaller** than standard JPEG at equivalent quality
- **4:2:0 chroma subsampling** reduces color data (imperceptible to human eye)
- **Quality 85** provides excellent visual quality with significant size reduction

### Filename Generation

```
icloud_YYYYMMDD_HHMMSS[_NNN][_counter].jpg
        │              │      │
        │              │      └── Collision counter (if file exists)
        │              └── Album index (--all mode only)
        └── Date/time from EXIF or capture time
```

**Examples:**
```
icloud_20240115_143245.jpg          # Single photo
icloud_20240115_143245_001.jpg      # Album photo 1
icloud_20240115_143245_002.jpg      # Album photo 2
icloud_20240115_143245_001_1.jpg    # Collision (file existed)
```

---

## 🔍 Download Verification

giil implements a multi-layer content validation system to ensure downloads are valid images, not error pages or corrupted data.

### The Problem

Cloud services often return HTML error pages with 200 status codes, making it impossible to detect failures from HTTP status alone:

```
❌ Expected: JPEG image data
✓ Received: HTTP 200
❌ Actual content: <html><body>This link has expired</body></html>
```

### Content Validation Pipeline

Every downloaded file passes through three validation checks before being accepted:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Content-Type   │────▶│  Magic Bytes    │────▶│  HTML Error     │
│   Validation    │     │   Detection     │     │   Detection     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Check MIME type         Verify file            Reject HTML
   matches image        signature bytes         error pages
```

### Stage 1: Content-Type Validation

Validates the HTTP `Content-Type` header matches expected image types:

```javascript
// Accepted MIME types:
'image/jpeg'
'image/png'
'image/webp'
'image/heic'
'image/heif'
'image/gif'
'application/octet-stream'  // Binary fallback (validated by magic bytes)
```

### Stage 2: Magic Bytes Detection

Verifies the file's binary signature matches known image formats, regardless of what the server claimed:

| Format | Magic Bytes (hex) | Description |
|--------|-------------------|-------------|
| JPEG | `FF D8 FF` | JFIF/Exif image |
| PNG | `89 50 4E 47` | Portable Network Graphics |
| GIF | `47 49 46 38` | Graphics Interchange Format |
| WebP | `52 49 46 46...57 45 42 50` | RIFF container with WEBP |
| HEIC/HEIF | `00 00 00...66 74 79 70` | ISO base media file (ftyp box) |
| BMP | `42 4D` | Windows Bitmap |

**Why this matters:** A server might claim `Content-Type: image/jpeg` but actually serve an HTML error page. Magic bytes catch this.

### Stage 3: HTML Error Page Detection

Scans the first bytes of content for HTML signatures that indicate an error page was returned instead of an image:

```javascript
// Rejected patterns:
'<!DOCTYPE'
'<!doctype'
'<html'
'<HTML'
'<head'
'<HEAD'
```

**Edge case handling:** Some valid images (especially JPEG) can contain embedded metadata that coincidentally matches HTML patterns. giil validates magic bytes *first*, so a valid JPEG with HTML-like EXIF comments passes validation.

### HEIC-in-JPEG Detection

A special case: Apple devices sometimes wrap HEIC data inside a JPEG container. giil detects this by scanning for the `ftypheic` signature after the JPEG header and triggers HEIC conversion:

```javascript
// Detect HEIC hidden in JPEG wrapper
if (startsWithJPEG && containsHeicSignature) {
    // Extract and convert the inner HEIC data
}
```

### Validation in Practice

```bash
# giil validates automatically - no flags needed
giil "https://share.icloud.com/photos/XXX"

# If validation fails, you'll see:
# [giil] Error: Downloaded content is not a valid image
# [giil] Received HTML error page instead of image data
```

---

## 🧭 Design Principles

### 1. Self-Healing Dependencies

giil automatically detects and installs missing components:

```
User runs giil
      │
      ├── Node.js missing?
      │   └── Install via brew/apt/dnf/yum/pacman
      │
      ├── Playwright missing?
      │   └── npm install in cache directory
      │
      ├── Chromium missing?
      │   └── npx playwright install chromium
      │
      └── All deps present → Run extractor
```

### 2. Graceful Degradation

Every operation has fallbacks:

| Component | Primary | Fallback |
|-----------|---------|----------|
| Image capture | Download button | Network → Screenshot |
| HEIC conversion | Sharp native | System tools (sips/heif-convert) |
| EXIF datetime | DateTimeOriginal | Other fields → Current time |
| Album navigation | Close button | Escape key |
| CLI output styling | gum | ANSI escape codes |

### 3. Single-File Distribution

The entire Node.js extractor is embedded in the bash script as a heredoc:

```bash
create_extractor_script() {
    cat > "$script_path" << 'SCRIPT_EOF'
    // ~560 lines of JavaScript
    SCRIPT_EOF
}
```

**Benefits:**
- No separate files to manage
- Easy to inspect and audit
- Simple installation (one file)
- Regenerated fresh each run

### 4. XDG Compliance

giil respects the XDG Base Directory Specification:

```bash
CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
GIIL_HOME="${GIIL_HOME:-$CACHE_HOME/giil}"
```

### 5. Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│  Bash Layer                                                      │
│  • CLI parsing and validation                                   │
│  • Dependency detection and installation                        │
│  • URL normalization                                            │
│  • Process orchestration                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Node.js Layer                                                   │
│  • Browser automation (Playwright)                              │
│  • Network interception                                         │
│  • Image capture strategies                                     │
│  • Image processing (Sharp)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

### Component Overview

```
giil (bash wrapper, ~1,150 LOC)
├── CLI argument parsing
├── OS detection (macOS/Linux)
├── Node.js installation
├── Playwright setup
├── gum installation (optional)
├── URL normalization
├── Extractor script generation
└── Node.js invocation

extractor.mjs (embedded JavaScript, ~1,450 LOC)
├── Playwright browser management
├── Response interception handler
├── Download button detector
├── Screenshot capture
├── EXIF datetime extraction
├── HEIC conversion
├── Sharp image processing
├── Filename generation
└── Output formatting
```

### Dependency Graph

```
giil
 │
 ├── Node.js ≥18
 │    └── npm
 │
 ├── Playwright ^1.40.0
 │    └── Chromium (headless browser)
 │
 ├── Sharp ^0.33.0
 │    ├── libvips (native image library)
 │    └── MozJPEG encoder
 │
 ├── exifr ^7.1.3
 │    └── EXIF/IPTC/XMP parser
 │
 └── gum (optional)
      └── charmbracelet CLI styling
```

---

## 🧪 Testing & Quality Assurance

giil includes a comprehensive testing infrastructure to ensure reliability.

### Unit Test Framework

The test suite validates pure JavaScript functions extracted from the embedded extractor:

```
scripts/tests/
├── run-tests.sh              # Test runner
├── extract-functions.mjs     # Extracts pure functions from giil
├── platform-detection.test.mjs    # Platform URL detection tests
└── (more test files...)
```

**Running tests:**
```bash
# Run all unit tests
./scripts/tests/run-tests.sh

# Output:
# === giil Unit Tests ===
# [1/2] Verifying function extraction...
#       Extraction OK
# [2/2] Running unit tests...
# ✓ detectPlatform > iCloud URLs > detects share.icloud.com/photos URLs
# ...
# Done!
```

**Test architecture:**
- Tests use Node.js 18+ native test runner (`node:test`)
- Functions are extracted from giil at test time (no separate source files)
- Each test file independently extracts functions in its `before()` hook

### What's Tested

| Test Suite | Coverage |
|------------|----------|
| Platform Detection | URL pattern matching for iCloud, Dropbox, Google Photos, Google Drive |
| Domain Boundary Checks | Rejects fake domains (e.g., `fakedropbox.com` vs `dropbox.com`) |
| Case Insensitivity | URL matching works regardless of case |
| Edge Cases | Empty strings, malformed URLs, query parameters |

### CI Pipeline

GitHub Actions runs quality checks on every push:

```yaml
# .github/workflows/ci.yml
jobs:
  unit-tests:
    - Setup Node.js 18
    - Run: ./scripts/tests/run-tests.sh

  shellcheck:
    - Lint giil and install.sh
    - Fail on warning-level issues

  syntax-validation:
    - Verify bash syntax
    - Verify embedded JS syntax

  installation-test:
    - Test curl-bash installer
    - Verify giil runs after install
```

### Integration Tests

For testing against real iCloud links:

```bash
# Requires GIIL_REAL_TEST_URL environment variable
./scripts/real_link_test.sh
```

This test:
1. Downloads from a real iCloud share link
2. Verifies the file matches expected SHA256 checksum
3. Validates image dimensions and format

### Code Quality

**ShellCheck** enforces bash best practices:
```bash
shellcheck -x giil install.sh
```

**Embedded JavaScript** syntax validation:
```bash
# Extract and check JS syntax
node --check ~/.cache/giil/extractor.mjs
```

---

## 🗂️ File Locations

### Runtime Cache (XDG-compliant)

| Path | Purpose |
|------|---------|
| `~/.cache/giil/` | Runtime directory (or `$XDG_CACHE_HOME/giil`) |
| `~/.cache/giil/node_modules/` | Playwright, Sharp, exifr packages |
| `~/.cache/giil/extractor.mjs` | Generated Node.js extraction script |
| `~/.cache/giil/package.json` | npm package manifest |
| `~/.cache/giil/.installed` | Installation marker file |
| `~/.cache/giil/ms-playwright/` | Chromium browser cache |

### Installation Location

| Path | Purpose |
|------|---------|
| `~/.local/bin/giil` | Main script (default install) |
| `/usr/local/bin/giil` | System install (`GIIL_SYSTEM=1`) |

### Debug Artifacts

When using `--debug`, on failure:

| File | Contents |
|------|----------|
| `giil_debug_<timestamp>.png` | Full-page screenshot |
| `giil_debug_<timestamp>.html` | Page DOM content |

---

## 🏎️ Performance

### Timing Breakdown

| Phase | First Run | Subsequent Runs |
|-------|-----------|-----------------|
| Dependency check | <1s | <1s |
| Chromium download | 30-60s | Skipped (cached) |
| Browser launch | 2-3s | 2-3s |
| Page load | 3-10s | 3-10s |
| Image capture | 1-5s | 1-5s |
| Image processing | <1s | <1s |
| **Total** | **40-80s** | **5-15s** |

### Resource Usage

| Resource | Typical Usage |
|----------|---------------|
| Memory (during run) | 200-400 MB |
| Disk (Chromium cache) | ~500 MB |
| Disk (node_modules) | ~50 MB |
| Network (per image) | Original image size |

### Optimization Tips

```bash
# Lower quality for faster processing and smaller files
giil "..." --quality 60

# Increase timeout for slow networks
giil "..." --timeout 120

# Force dependency update if issues occur
giil "..." --update
```

---

## 🧭 Troubleshooting

### Common Issues

<details>
<summary><strong>"Node.js not found"</strong></summary>

**Cause:** Node.js not installed or not in PATH.

**Fix:** giil auto-installs Node.js, but you can also install manually:
```bash
# macOS
brew install node

# Ubuntu/Debian
sudo apt-get install nodejs npm

# Fedora
sudo dnf install nodejs npm
```

</details>

<details>
<summary><strong>Timeout errors</strong></summary>

**Cause:** Slow network or iCloud service issues.

**Fixes:**
1. Increase timeout: `giil "..." --timeout 120`
2. Check if URL works in browser
3. Try again later (iCloud may be slow)

</details>

<details>
<summary><strong>"Failed to capture image"</strong></summary>

**Cause:** All capture strategies failed.

**Fixes:**
1. Run with `--debug` to get screenshot and HTML
2. Check debug screenshot to see page state
3. Open GitHub issue with debug artifacts

</details>

<details>
<summary><strong>Small/wrong image captured</strong></summary>

**Cause:** Captured thumbnail instead of full resolution.

**Fixes:**
1. Should auto-select largest image
2. Try with `--debug` to investigate
3. Report if persistent (include URL)

</details>

<details>
<summary><strong>HEIC conversion fails on Linux</strong></summary>

**Cause:** `heif-convert` not installed.

**Fix:**
```bash
# Ubuntu/Debian
sudo apt-get install libheif-examples

# Fedora
sudo dnf install libheif-tools

# Arch
sudo pacman -S libheif
```

</details>

<details>
<summary><strong>Chromium fails to launch</strong></summary>

**Cause:** Missing system dependencies (common on headless servers).

**Fix:**
```bash
# Force reinstall with system deps
giil "..." --update

# Or manually:
cd ~/.cache/giil && npx playwright install --with-deps chromium
```

</details>

### Debug Mode

Use `--debug` to capture diagnostic information:

```bash
giil "https://share.icloud.com/photos/XXX" --debug
```

On failure, this saves:
- `giil_debug_<timestamp>.png` - Screenshot of page state
- `giil_debug_<timestamp>.html` - Full DOM for inspection

### Verbose and Trace Modes

For deeper debugging:

```bash
# Verbose: detailed progress logging
giil "..." --verbose

# Trace: Playwright trace recording (generates trace.zip)
giil "..." --trace

# View trace in browser
npx playwright show-trace ~/.cache/giil/trace.zip
```

---

## 🔢 Exit Codes

giil uses semantic exit codes for scripting and error handling:

| Code | Name | Description |
|------|------|-------------|
| `0` | Success | Image captured and saved/output |
| `1` | Capture Failure | All capture strategies failed |
| `2` | Usage Error | Invalid arguments or missing URL |
| `3` | Dependency Error | Node.js, Playwright, or Chromium issue |
| `10` | Network Error | Timeout, DNS failure, unreachable host |
| `11` | Auth Required | Login redirect, password required, not publicly shared |
| `12` | Not Found | Expired link, deleted file, 404 |
| `13` | Unsupported Type | Video, Google Doc, or non-image content |
| `20` | Internal Error | Bug in giil (please report!) |

**Scripting with exit codes:**
```bash
giil "https://share.icloud.com/photos/XXX" 2>/dev/null
case $? in
    0) echo "Success!" ;;
    10) echo "Network issue - retry later" ;;
    11) echo "Link not public - ask owner to share" ;;
    12) echo "Link expired" ;;
    *) echo "Failed with code $?" ;;
esac
```

---

## 🎨 Terminal Styling

giil integrates with [gum](https://github.com/charmbracelet/gum) for beautiful terminal output when available:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│   ╔════════════════════════════════════════════════════════════╗ │
│   ║                           giil                              ║ │
│   ║               Get iCloud Image Link v3.0.0                  ║ │
│   ╚════════════════════════════════════════════════════════════╝ │
│                                                                   │
│   ◐ Launching browser...                                          │
│   ✓ Download button clicked                                       │
│   ✓ Image processed: 4032×3024, 1.2 MB → 456 KB                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Styling Behavior

| Environment | Output Style |
|-------------|--------------|
| TTY with gum installed | Full gum styling (banners, spinners, colors) |
| TTY without gum | ANSI color codes |
| Non-TTY (piped) | Plain text |
| CI environment (`$CI` set) | Plain text, no gum |
| `GIIL_NO_GUM=1` | Force ANSI fallback |

### Install gum (Optional)

```bash
# macOS
brew install gum

# Linux (apt)
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
sudo apt update && sudo apt install gum

# Arch
sudo pacman -S gum
```

---

## 🌐 Environment Variables

### Runtime Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `XDG_CACHE_HOME` | Base cache directory | `~/.cache` |
| `GIIL_HOME` | giil runtime directory | `$XDG_CACHE_HOME/giil` |
| `PLAYWRIGHT_BROWSERS_PATH` | Custom Chromium cache | `$GIIL_HOME/ms-playwright` |
| `GIIL_NO_GUM` | Disable gum installation | unset |
| `GIIL_CHECK_UPDATES` | Enable update checking (set to `1`) | unset |
| `NODE_OPTIONS` | Node.js options | unset |
| `CI` | Detected CI environment (disables gum) | unset |

### Installer Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEST` | Custom install directory | `~/.local/bin` |
| `GIIL_SYSTEM` | Install to `/usr/local/bin` (set to `1`) | unset |
| `GIIL_NO_ALIAS` | Skip adding directory to PATH | unset |
| `GIIL_VERIFY` | Verify SHA256 checksum (set to `1`) | unset |
| `GIIL_VERSION` | Install specific version | latest |

**Example: Custom cache location**
```bash
export XDG_CACHE_HOME=/var/cache/myapp
giil "https://share.icloud.com/photos/XXX"
# Uses /var/cache/myapp/giil/
```

**Example: Enable update checking**
```bash
export GIIL_CHECK_UPDATES=1
giil "https://share.icloud.com/photos/XXX"
# Will notify if a newer version is available (once per day)
```

**Example: Verified installation**
```bash
GIIL_VERIFY=1 curl -fsSL .../install.sh | bash
# Verifies SHA256 checksum against GitHub release
```

---

## 📦 Dependencies

### Automatically Installed

| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | ≥18 | JavaScript runtime |
| Playwright | ^1.40.0 | Browser automation |
| Chromium | (via Playwright) | Headless browser |
| Sharp | ^0.33.0 | Image processing |
| exifr | ^7.1.3 | EXIF metadata parsing |
| gum | latest | CLI styling (optional) |

### System Requirements

| Platform | Requirements |
|----------|--------------|
| macOS | macOS 10.15+ (Catalina or later) |
| Linux | glibc 2.17+ (Ubuntu 18.04+, Debian 10+) |
| Node.js | v18 or later |

---

## 🛡️ Security & Privacy

### Privacy Guarantees

- **Local execution:** All processing happens on your machine
- **No telemetry:** No data sent anywhere except to iCloud
- **No authentication stored:** Uses iCloud's public share mechanism
- **No cookies saved:** Browser context is ephemeral

### Security Considerations

- **Sandboxed browser:** Chromium runs with `--no-sandbox` for compatibility but in headless mode with no persistent state
- **No code execution:** Only loads iCloud URLs, no JavaScript injection
- **Temp file cleanup:** Downloaded files cleaned up after processing

### Audit

The entire codebase is contained in a single bash script (~1,150 lines of bash wrapper) with an embedded JavaScript extractor (~1,450 lines):

```bash
less ~/.local/bin/giil
```

---

## 🔧 Uninstallation

```bash
# Remove script
rm ~/.local/bin/giil

# Remove runtime and cache
rm -rf ~/.cache/giil

# Remove Playwright browsers (if no other Playwright tools)
rm -rf ~/.cache/ms-playwright
```

---

## 🤝 Contributing

> *About Contributions:* Please don't take this the wrong way, but I do not accept outside contributions for any of my projects. I simply don't have the mental bandwidth to review anything, and it's my name on the thing, so I'm responsible for any problems it causes; thus, the risk-reward is highly asymmetric from my perspective. I'd also have to worry about other "stakeholders," which seems unwise for tools I mostly make for myself for free. Feel free to submit issues, and even PRs if you want to illustrate a proposed fix, but know I won't merge them directly. Instead, I'll have Claude or Codex review submissions via `gh` and independently decide whether and how to address them. Bug reports in particular are welcome. Sorry if this offends, but I want to avoid wasted time and hurt feelings. I understand this isn't in sync with the prevailing open-source ethos that seeks community contributions, but it's the only way I can move at this velocity and keep my sanity.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**[Report Bug](https://github.com/Dicklesworthstone/get_icloud_image_link/issues) · [Request Feature](https://github.com/Dicklesworthstone/get_icloud_image_link/issues)**

---

<sub>Built with Playwright, Sharp, and a healthy disregard for iCloud's lack of an API.</sub>

</div>
