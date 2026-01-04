# AGENTS.md — giil (Get Image [from] Internet Link) Project

## RULE 1 – ABSOLUTE (DO NOT EVER VIOLATE THIS)

You may NOT delete any file or directory unless I explicitly give the exact command **in this session**.

- This includes files you just created (tests, tmp files, scripts, etc.).
- You do not get to decide that something is "safe" to remove.
- If you think something should be removed, stop and ask. You must receive clear written approval **before** any deletion command is even proposed.

Treat "never delete files without permission" as a hard invariant.

---

## IRREVERSIBLE GIT & FILESYSTEM ACTIONS

Absolutely forbidden unless I give the **exact command and explicit approval** in the same message:

- `git reset --hard`
- `git clean -fd`
- `rm -rf`
- Any command that can delete or overwrite code/data

Rules:

1. If you are not 100% sure what a command will delete, do not propose or run it. Ask first.
2. Prefer safe tools: `git status`, `git diff`, `git stash`, copying to backups, etc.
3. After approval, restate the command verbatim, list what it will affect, and wait for confirmation.
4. When a destructive command is run, record in your response:
   - The exact user text authorizing it
   - The command run
   - When you ran it

If that audit trail is missing, then you must act as if the operation never happened.

---

## Hybrid Bash + Node.js Discipline

This is a **hybrid project**: a Bash wrapper script with an embedded Node.js extractor.

### Bash Layer (giil, install.sh)

- Target **Bash 4.0+** compatibility. Use `#!/usr/bin/env bash` shebang.
- Use `set -euo pipefail` for strict error handling.
- Use ShellCheck to lint all scripts. Address all warnings at severity `warning` or higher.
- Ignore rules: `SC2155` (declare and assign separately), `SC2034` (unused variables in heredocs).

### Node.js Layer (extractor.mjs, embedded)

- The extractor is embedded in the giil script as a heredoc — regenerated fresh each run.
- Use ES modules (`"type": "module"` in package.json).
- Target **Node.js 18+**.
- Dependencies: Playwright 1.40.0, Sharp 0.33.0, exifr 7.1.3.

### Key Patterns

- **Stream separation** — stderr for human-readable output (logs, progress), stdout for structured data (paths, JSON, base64).
- **XDG compliance** — Runtime cache in `~/.cache/giil/`, respect `XDG_CACHE_HOME`.
- **No global `cd`** — Use absolute paths; change directory only when necessary.
- **Graceful degradation** — Every operation has fallbacks (HEIC conversion, selectors, capture strategies).

---

## Project Architecture

**giil** (Get Image [from] Internet Link) is a zero-setup CLI that downloads full-resolution images from cloud sharing services.

### Supported Platforms

| Platform | Method | Browser Required |
|----------|--------|------------------|
| **iCloud** | 4-tier capture strategy | Yes (Playwright) |
| **Dropbox** | Direct URL (`raw=1`) | No |
| **Google Photos** | URL extraction + `=s0` | Yes (Playwright) |
| **Google Drive** | Multi-tier with auth detection | Yes (Playwright) |

### Key Features

- **One-liner curl-bash installation** with optional checksum verification
- **Self-contained** — Single bash script with embedded Node.js extractor
- **Auto-dependency management** — Installs Node.js, Playwright, Chromium, Sharp as needed
- **4-tier capture strategy** — Download button → Network CDN → Element screenshot → Viewport
- **Album mode** — Download all photos from shared albums (`--all`)
- **Multiple output formats** — File path (default), JSON metadata, Base64 encoding
- **HEIC/HEIF conversion** — Platform-aware (sips on macOS, heif-convert on Linux)
- **MozJPEG compression** — 40-50% smaller files with configurable quality

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--output DIR` | `.` | Output directory for saved images |
| `--preserve` | off | Preserve original bytes (skip MozJPEG compression) |
| `--convert FMT` | — | Convert to format: `jpeg`, `png`, `webp` |
| `--quality N` | `85` | JPEG quality (1-100) |
| `--base64` | off | Output base64 to stdout instead of saving file |
| `--json` | off | Output JSON metadata (path, datetime, dimensions, method) |
| `--all` | off | Download all photos from a shared album |
| `--timeout N` | `60` | Page load timeout in seconds |
| `--debug` | off | Save debug artifacts (screenshot + HTML) on failure |
| `--update` | off | Force reinstall of Playwright and dependencies |
| `--version` | — | Print version and exit |
| `--help` | — | Show help message |

> **Default:** MozJPEG compression for optimal size/quality. Use `--preserve` to keep original bytes.

---

## Repo Layout

```
giil/
├── giil                                    # Main script (~2600 LOC: ~1150 bash + ~1450 embedded JS)
├── install.sh                              # Curl-bash installer (~350 LOC)
├── README.md                               # Comprehensive documentation
├── VERSION                                 # Semver version file (e.g., "2.1.0")
├── LICENSE                                 # MIT License
├── AGENTS.md                               # This file
├── PLAN_TO_EXPAND_GIIL_TO_OTHER_SERVICES.md  # Multi-platform expansion plan
├── .gitignore                              # Ignore runtime artifacts
├── .github/
│   └── workflows/
│       ├── ci.yml                          # ShellCheck, syntax, installation tests
│       └── release.yml                     # GitHub releases with checksums
└── scripts/
    ├── real_link_test.sh                   # Integration test with real iCloud links
    ├── check_playwright_setup.sh           # Playwright verification utility
    ├── real_icloud_expected.sha256         # Expected checksum for test image
    └── tests/                              # Unit test framework
        ├── run-tests.sh                    # Test runner
        ├── extract-functions.mjs           # Extracts pure functions from giil
        └── *.test.mjs                      # Test files (platform-detection, etc.)
```

### Embedded Components

The `giil` script contains an embedded Node.js extractor generated via heredoc:

```
giil (bash)
└── create_extractor_script()
    └── Generates: ~/.cache/giil/extractor.mjs (~1450 LOC JavaScript)
        ├── Playwright browser automation
        ├── Network interception (CDN capture)
        ├── 4-tier capture strategy
        ├── Sharp image processing
        ├── EXIF datetime extraction
        └── Output formatting (file/JSON/base64)
```

---

## XDG-Compliant Runtime Layout

```
~/.cache/giil/                     # Or $XDG_CACHE_HOME/giil
├── node_modules/                  # Playwright, Sharp, exifr packages
├── ms-playwright/                 # Chromium browser cache
├── extractor.mjs                  # Generated Node.js extraction script
├── package.json                   # npm package manifest
├── package-lock.json              # Dependency lockfile
├── .installed                     # Installation marker file
└── .last_update_check             # Update check timestamp
```

---

## Exit Codes

v3.0 introduced an expanded exit code scheme. Codes 4-5 from v2 moved to 10-11.

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Image captured and saved/output |
| `1` | Capture failure | All capture strategies failed |
| `2` | Invalid arguments | Bad CLI options, missing URL |
| `3` | Dependency error | Node.js/Playwright/Chromium missing or failed |
| `10` | Network/timeout | Page load timeout, DNS failure, unreachable |
| `11` | Auth required | Login redirect, password required, not public |
| `12` | Not found | Expired link, deleted file, 404 |
| `13` | Unsupported type | Video, Google Doc, non-image content |
| `20` | Internal error | Bug in giil (please report!) |

---

## Capture Strategy Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    URL Input                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ detect_platform()│
                    └──────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌──────────┐          ┌──────────┐
   │ Dropbox │          │  Google  │          │  iCloud/ │
   │ (curl)  │          │  Photos  │          │  GDrive  │
   └─────────┘          └──────────┘          └──────────┘
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────────────────────────────────────────────────────────┐
   │              extractor.mjs (Playwright)                      │
   │                                                               │
   │   TIER 1: Download button (9 selectors)                       │
   │      ↓ fail                                                   │
   │   TIER 2: Network CDN interception (>10KB)                    │
   │      ↓ fail                                                   │
   │   TIER 3: Element screenshot (10 selectors)                   │
   │      ↓ fail                                                   │
   │   TIER 4: Viewport screenshot (always succeeds)               │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Image Processing │
                    │  Sharp + MozJPEG │
                    │  EXIF extraction │
                    │  HEIC conversion │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     Output       │
                    │ (file/json/b64)  │
                    └──────────────────┘
```

---

## Generated Files — NEVER Edit Manually

**Current state:** The extractor.mjs is generated at runtime from an embedded heredoc.

- **Rule:** Never hand-edit `~/.cache/giil/extractor.mjs` — it's regenerated each run.
- **To modify the extractor:** Edit the heredoc inside the `create_extractor_script()` function in `giil`.

---

## Code Editing Discipline

- Do **not** run scripts that bulk-modify code (codemods, invented one-off scripts, giant `sed`/regex refactors).
- Large mechanical changes: break into smaller, explicit edits and review diffs.
- Subtle/complex changes: edit by hand, file-by-file, with careful reasoning.
- The embedded JavaScript heredoc is sensitive — maintain proper escaping.

---

## Backwards Compatibility & File Sprawl

We optimize for a clean architecture now, not backwards compatibility.

- No "compat shims" or "v2" file clones.
- When changing behavior, migrate callers and remove old code.
- New files are only for genuinely new domains that don't fit existing modules.
- The bar for adding files is very high.

---

## Console Output Design

Output stream rules:
- **stderr**: All human-readable output (progress, errors, summary, help, `[giil]` prefix)
- **stdout**: Only structured output (file path, JSON in `--json` mode, base64 in `--base64` mode)

Visual design:
- Use **gum** when available for beautiful terminal UI (banners, spinners, styled text)
- Fall back to ANSI color codes when gum is unavailable
- Suppress gum in CI environments or when `GIIL_NO_GUM=1`

---

## Tooling Assumptions (recommended)

This section is a **developer toolbelt** reference.

### Shell & Terminal UX
- **zsh** + **oh-my-zsh** + **powerlevel10k**
- **lsd** (or eza fallback) — Modern ls
- **atuin** — Shell history with Ctrl-R
- **fzf** — Fuzzy finder
- **zoxide** — Better cd
- **direnv** — Directory-specific env vars

### Dev Tools
- **tmux** — Terminal multiplexer
- **ripgrep** (`rg`) — Fast search
- **ast-grep** (`sg`) — Structural search/replace
- **lazygit** — Git TUI
- **bat** — Better cat
- **gum** — Glamorous shell scripts (used by giil for UI)
- **ShellCheck** — Shell script linter
- **ImageMagick** — Image inspection (`identify` command)

### Coding Agents
- **Claude Code** — Anthropic's coding agent
- **Codex CLI** — OpenAI's coding agent
- **Gemini CLI** — Google's coding agent

### Dependencies for giil
- **Node.js 18+** — JavaScript runtime
- **Playwright** — Browser automation
- **Chromium** — Headless browser (via Playwright)
- **Sharp** — Image processing with MozJPEG
- **exifr** — EXIF metadata parsing
- **curl** — For installer and direct downloads
- **sips** (macOS) or **heif-convert** (Linux) — HEIC conversion

### Dicklesworthstone Stack (all 8 tools)
1. **ntm** — Named Tmux Manager (agent cockpit)
2. **mcp_agent_mail** — Agent coordination via mail-like messaging
3. **ultimate_bug_scanner** (`ubs`) — Bug scanning with guardrails
4. **beads_viewer** (`bv`) — Task management TUI
5. **coding_agent_session_search** (`cass`) — Unified agent history search
6. **cass_memory_system** (`cm`) — Procedural memory for agents
7. **coding_agent_account_manager** (`caam`) — Agent auth switching
8. **simultaneous_launch_button** (`slb`) — Two-person rule for dangerous commands

---

## MCP Agent Mail — Multi-Agent Coordination

Agent Mail is available as an MCP server for coordinating work across agents.

### CRITICAL: How Agents Access Agent Mail

**Coding agents (Claude Code, Codex, Gemini CLI) access Agent Mail NATIVELY via MCP tools.**

- You do NOT need to implement HTTP wrappers, client classes, or JSON-RPC handling
- MCP tools are available directly in your environment (e.g., `macro_start_session`, `send_message`, `fetch_inbox`)
- If MCP tools aren't available, flag it to the user — they may need to start the Agent Mail server

What Agent Mail gives:
- Identities, inbox/outbox, searchable threads.
- Advisory file reservations (leases) to avoid agents clobbering each other.
- Persistent artifacts in git (human-auditable).

Core patterns:

1. **Same repo**
   - Register identity:
     - `ensure_project` then `register_agent` with the repo's absolute path as `project_key`.
   - Reserve files before editing:
     - `file_reservation_paths(project_key, agent_name, ["giil", "install.sh"], ttl_seconds=3600, exclusive=true)`.
   - Communicate:
     - `send_message(..., thread_id="FEAT-123")`.
     - `fetch_inbox`, then `acknowledge_message`.
   - Fast reads:
     - `resource://inbox/{Agent}?project=<abs-path>&limit=20`.
     - `resource://thread/{id}?project=<abs-path>&include_bodies=true`.

2. **Macros vs granular:**
   - Prefer macros when speed is more important than fine-grained control:
     - `macro_start_session`, `macro_prepare_thread`, `macro_file_reservation_cycle`, `macro_contact_handshake`.
   - Use granular tools when you need explicit behavior.

Common pitfalls:
- "from_agent not registered" → call `register_agent` with correct `project_key`.
- `FILE_RESERVATION_CONFLICT` → adjust patterns, wait for expiry, or use non-exclusive reservation.

---

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - ShellCheck, syntax validation, tests
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds


---

## Issue Tracking with bd (beads)

All issue tracking goes through **bd**. No other TODO systems.

Key invariants:

- `.beads/` is authoritative state and **must always be committed** with code changes.
- Do not edit `.beads/*.jsonl` directly; only via `bd`.

### Basics

Check ready work:

```bash
bd ready --json
```

Create issues:

```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

Update:

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

Complete:

```bash
bd close bd-42 --reason "Completed" --json
```

Types:

- `bug`, `feature`, `task`, `epic`, `chore`

Priorities:

- `0` critical (security, data loss, broken builds)
- `1` high
- `2` medium (default)
- `3` low
- `4` backlog

Agent workflow:

1. `bd ready` to find unblocked work.
2. Claim: `bd update <id> --status in_progress`.
3. Implement + test.
4. If you discover new work, create a new bead with `discovered-from:<parent-id>`.
5. Close when done.
6. Commit `.beads/` in the same commit as code changes.

Auto-sync:

- bd exports to `.beads/issues.jsonl` after changes (debounced).
- It imports from JSONL when newer (e.g. after `git pull`).

Never:

- Use markdown TODO lists.
- Use other trackers.
- Duplicate tracking.

---

### Using bv as an AI sidecar

bv is a graph-aware triage engine for Beads projects (.beads/beads.jsonl). Instead of parsing JSONL or hallucinating graph traversal, use robot flags for deterministic, dependency-aware outputs with precomputed metrics (PageRank, betweenness, critical path, cycles, HITS, eigenvector, k-core).

**Scope boundary:** bv handles *what to work on* (triage, priority, planning). For agent-to-agent coordination (messaging, work claiming, file reservations), use MCP Agent Mail, which should be available to you as an MCP server (if it's not, then flag to the user; they might need to start Agent Mail using the `am` alias or by running `cd "<directory_where_they_installed_agent_mail>/mcp_agent_mail" && bash scripts/run_server_with_token.sh)' if the alias isn't available or isn't working.

**Use ONLY `--robot-*` flags. Bare `bv` launches an interactive TUI that blocks your session.**

#### The Workflow: Start With Triage

**`bv --robot-triage` is your single entry point.** It returns everything you need in one call:
- `quick_ref`: at-a-glance counts + top 3 picks
- `recommendations`: ranked actionable items with scores, reasons, unblock info
- `quick_wins`: low-effort high-impact items
- `blockers_to_clear`: items that unblock the most downstream work
- `project_health`: status/type/priority distributions, graph metrics
- `commands`: copy-paste shell commands for next steps

```bash
bv --robot-triage        # THE MEGA-COMMAND: start here
bv --robot-next          # Minimal: just the single top pick + claim command
```

#### Other bv Commands

**Planning:**
| Command | Returns |
|---------|---------|
| `--robot-plan` | Parallel execution tracks with `unblocks` lists |
| `--robot-priority` | Priority misalignment detection with confidence |

**Graph Analysis:**
| Command | Returns |
|---------|---------|
| `--robot-insights` | Full metrics: PageRank, betweenness, HITS, eigenvector, critical path, cycles, k-core, articulation points, slack |

Use bv instead of parsing beads.jsonl—it computes PageRank, critical paths, cycles, and parallel tracks deterministically.

---

### Morph Warp Grep — AI-Powered Code Search

Use `mcp__morph-mcp__warp_grep` for "how does X work?" discovery across the codebase.

When to use:

- You don't know where something lives.
- You want data flow across multiple files.
- You want all touchpoints of a cross-cutting concern.

Example:

```
mcp__morph-mcp__warp_grep(
  repoPath: "/data/projects/giil",
  query: "How does the 4-tier capture strategy decide which method to use?"
)
```

Warp Grep:

- Expands a natural-language query to multiple search patterns.
- Runs targeted greps, reads code, follows imports, then returns concise snippets with line numbers.
- Reduces token usage by returning only relevant slices, not entire files.

When **not** to use Warp Grep:

- You already know the function/identifier name; use `rg`.
- You know the exact file; just open it.
- You only need a yes/no existence check.

Comparison:

| Scenario | Tool |
| ---------------------------------- | ---------- |
| "How does network interception work?" | warp_grep |
| "Where is `processAndSaveImage` defined?" | `rg` |
| "Replace `var` with `let`" | `ast-grep` |

---

### cass — Cross-Agent Search

`cass` indexes prior agent conversations (Claude Code, Codex, Cursor, Gemini, ChatGPT, etc.) so we can reuse solved problems.

Rules:

- Never run bare `cass` (TUI). Always use `--robot` or `--json`.

Examples:

```bash
cass health
cass search "playwright network interception" --robot --limit 5
cass view /path/to/session.jsonl -n 42 --json
cass expand /path/to/session.jsonl -n 42 -C 3 --json
cass capabilities --json
cass robot-docs guide
```

Tips:

- Use `--fields minimal` for lean output.
- Filter by agent with `--agent`.
- Use `--days N` to limit to recent history.

stdout is data-only, stderr is diagnostics; exit code 0 means success.

Treat cass as a way to avoid re-solving problems other agents already handled.

---

## Memory System: cass-memory

The Cass Memory System (cm) is a tool for giving agents an effective memory based on the ability to quickly search across previous coding agent sessions and then reflect on what they find and learn in new sessions to draw out useful lessons and takeaways.

### Quick Start

```bash
# 1. Check status and see recommendations
cm onboard status

# 2. Get sessions to analyze (filtered by gaps in your playbook)
cm onboard sample --fill-gaps

# 3. Read a session with rich context
cm onboard read /path/to/session.jsonl --template

# 4. Add extracted rules (one at a time or batch)
cm playbook add "Your rule content" --category "debugging"

# 5. Mark session as processed
cm onboard mark-done /path/to/session.jsonl
```

Before starting complex tasks, retrieve relevant context:

```bash
cm context "<task description>" --json
```

This returns:
- **relevantBullets**: Rules that may help with your task
- **antiPatterns**: Pitfalls to avoid
- **historySnippets**: Past sessions that solved similar problems
- **suggestedCassQueries**: Searches for deeper investigation

### Protocol

1. **START**: Run `cm context "<task>" --json` before non-trivial work
2. **WORK**: Reference rule IDs when following them (e.g., "Following b-8f3a2c...")
3. **FEEDBACK**: Leave inline comments when rules help/hurt
4. **END**: Just finish your work. Learning happens automatically.

---

## UBS Quick Reference for AI Agents

UBS stands for "Ultimate Bug Scanner": **The AI Coding Agent's Secret Weapon: Flagging Likely Bugs for Fixing Early On**

**Golden Rule:** `ubs <changed-files>` before every commit. Exit 0 = safe. Exit >0 = fix & re-run.

**For Shell Scripts (giil, install.sh):**
```bash
ubs giil install.sh                       # Specific files (< 1s) — USE THIS
ubs $(git diff --name-only --cached)      # Staged files — before commit
ubs --only=bash .                         # All bash files
ubs --ci --fail-on-warning .              # CI mode — before PR
```

**For JavaScript (embedded extractor):**
The extractor is embedded in a heredoc, so direct linting requires extraction:
```bash
# Extract and lint the embedded JS (advanced)
sed -n '/^SCRIPT_EOF$/,/^SCRIPT_EOF$/p' giil | node --check
```

**Output Format:**
```
Warning  Category (N errors)
    file.sh:42:5 – Issue description
    Suggested fix
Exit code: 1
```
Parse: `file:line:col` -> location | Suggested fix -> how to fix | Exit 0/1 -> pass/fail

**Fix Workflow:**
1. Read finding -> category + fix suggestion
2. Navigate `file:line:col` -> view context
3. Verify real issue (not false positive)
4. Fix root cause (not symptom)
5. Re-run `ubs <file>` -> exit 0
6. Commit

**Speed Critical:** Scope to changed files. `ubs giil` (< 1s) vs `ubs .` (30s). Never full scan for small edits.

**Anti-Patterns:**
- Do not ignore findings -> Investigate each
- Do not full scan per edit -> Scope to file
- Do not fix symptom -> Fix root cause
