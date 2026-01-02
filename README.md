<p align="center">
  <img src="https://img.shields.io/badge/version-2.1.0-blue?style=for-the-badge" alt="Version" />
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
curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/get_icloud_image_link/main/install.sh | bash
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
- [Output Modes](#-output-modes)
- [Album Mode](#-album-mode)
- [How It Works](#-how-it-works)
- [Capture Strategies in Detail](#-capture-strategies-in-detail)
- [Image Processing Pipeline](#-image-processing-pipeline)
- [Design Principles](#-design-principles)
- [Architecture](#-architecture)
- [File Locations](#-file-locations)
- [Performance](#-performance)
- [Troubleshooting](#-troubleshooting)
- [Environment Variables](#-environment-variables)
- [Dependencies](#-dependencies)
- [Security & Privacy](#-security--privacy)
- [Uninstallation](#-uninstallation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 💡 Why giil Exists

iCloud photo shares present a unique challenge for automation:

| Problem | Why It's Hard | How giil Solves It |
|---------|---------------|-------------------|
| **JavaScript-heavy SPA** | Standard `curl`/`wget` can't execute JS or render the page | Headless Chromium via Playwright |
| **Dynamic image loading** | Images load asynchronously from CDN after page render | Network interception captures CDN responses |
| **No direct download links** | URLs are session-specific and expire quickly | Clicks native Download button or intercepts live requests |
| **Copy/paste loses quality** | Manual screenshots result in compressed/cropped images | Captures original resolution from source |
| **HEIC format on Apple devices** | Many tools can't process Apple's HEIC/HEIF format | Platform-aware conversion (sips/heif-convert) |

giil lets you programmatically download full-resolution images from any iCloud photo share link, which is otherwise impossible without manual browser interaction.

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

### Optimized Compression
MozJPEG for superior file sizes:
- Configurable quality (1-100)
- 40-50% smaller than originals
- 4:2:0 chroma subsampling
- Preserves visual quality

</td>
</tr>
</table>

---

## ⚡ Quickstart

### Installation

**One-liner (recommended):**
```bash
curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/get_icloud_image_link/main/install.sh | bash
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
| `--quality N` | `85` | JPEG quality (1-100) |
| `--base64` | off | Output base64 to stdout instead of saving file |
| `--json` | off | Output JSON metadata (path, datetime, dimensions, method) |
| `--all` | off | Download all photos from a shared album |
| `--timeout N` | `60` | Page load timeout in seconds |
| `--debug` | off | Save debug artifacts (screenshot + HTML) on failure |
| `--update` | off | Force reinstall of Playwright and dependencies |
| `--version` | — | Print version and exit |
| `--help` | — | Show help message |

### Supported URL Formats

Both formats are automatically detected and normalized:

```
https://share.icloud.com/photos/02cD9okNHvVd-uuDnPCH3ZEEA
https://www.icloud.com/photos/#02cD9okNHvVd-uuDnPCH3ZEEA
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

Returns structured metadata for programmatic use.

```bash
giil "https://share.icloud.com/photos/XXX" --json
```

```json
{
  "path": "/absolute/path/to/icloud_20240115_143245.jpg",
  "datetime": "2024-01-15T14:32:45.000Z",
  "sourceUrl": "https://cvws.icloud-content.com/...",
  "method": "network",
  "size": 245678,
  "width": 4032,
  "height": 3024
}
```

| Field | Description |
|-------|-------------|
| `path` | Absolute path to saved file |
| `datetime` | ISO 8601 timestamp (from EXIF or capture time) |
| `sourceUrl` | CDN URL where image was obtained |
| `method` | Capture strategy used (see [Capture Strategy](#-capture-strategy-deep-dive)) |
| `size` | File size in bytes |
| `width` | Image width in pixels |
| `height` | Image height in pixels |

**Parse with jq:**
```bash
giil "https://share.icloud.com/photos/XXX" --json | jq -r '.path'
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
   - Compresses with MozJPEG

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

### MozJPEG Compression

giil uses Sharp with MozJPEG for superior compression:

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
giil (bash, ~740 LOC)
├── CLI argument parsing
├── OS detection (macOS/Linux)
├── Node.js installation
├── Playwright setup
├── gum installation (optional)
├── URL normalization
├── Extractor script generation
└── Node.js invocation

extractor.mjs (JavaScript, ~585 LOC)
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

---

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `XDG_CACHE_HOME` | Base cache directory | `~/.cache` |
| `GIIL_HOME` | giil runtime directory | `$XDG_CACHE_HOME/giil` |
| `PLAYWRIGHT_BROWSERS_PATH` | Custom Chromium cache | `$GIIL_HOME/ms-playwright` |
| `GIIL_NO_GUM` | Disable gum installation | unset |
| `NODE_OPTIONS` | Node.js options | unset |
| `CI` | Detected CI environment (disables gum) | unset |

**Example: Custom cache location**
```bash
export XDG_CACHE_HOME=/var/cache/myapp
giil "https://share.icloud.com/photos/XXX"
# Uses /var/cache/myapp/giil/
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

The entire codebase is contained in a single bash script (~1,325 lines) with an embedded JavaScript extractor (~585 lines):

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
