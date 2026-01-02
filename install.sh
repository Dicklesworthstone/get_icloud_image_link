#!/usr/bin/env bash
#
# giil installer
# Downloads and installs giil (Get iCloud Image Link) to your system
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/get_icloud_image_link/main/install.sh | bash
#
# Options (via environment variables):
#   DEST=/path/to/dir      Install directory (default: ~/.local/bin)
#   GIIL_SYSTEM=1          Install to /usr/local/bin (requires sudo)
#   GIIL_NO_ALIAS=1        Skip adding shell alias
#   GIIL_VERIFY=1          Verify SHA256 checksum against GitHub release
#   GIIL_VERSION=x.y.z     Install specific version (default: latest from main)
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
REPO_OWNER="Dicklesworthstone"
REPO_NAME="get_icloud_image_link"
REPO_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main"
RELEASES_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases"
SCRIPT_NAME="giil"

log_info() { echo -e "${GREEN}[installer]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[installer]${NC} $1"; }
log_error() { echo -e "${RED}[installer]${NC} $1"; }
log_step() { echo -e "${BLUE}[installer]${NC} $1"; }

# Get version from installed giil (if exists)
get_installed_version() {
    local script_path="$1"
    if [[ -x "$script_path" ]]; then
        grep -m1 '^VERSION=' "$script_path" 2>/dev/null | cut -d'"' -f2 || echo ""
    else
        echo ""
    fi
}

# Get latest version from GitHub
get_latest_version() {
    local version_url="${REPO_URL}/VERSION"
    if command -v curl &> /dev/null; then
        curl -fsSL --connect-timeout 5 "$version_url" 2>/dev/null | tr -d '[:space:]' || echo ""
    elif command -v wget &> /dev/null; then
        wget -qO- --timeout=5 "$version_url" 2>/dev/null | tr -d '[:space:]' || echo ""
    else
        echo ""
    fi
}

# Verify SHA256 checksum (optional, enabled via GIIL_VERIFY=1)
verify_checksum() {
    local file="$1"
    local version="$2"

    if [[ -z "${GIIL_VERIFY:-}" ]]; then
        return 0
    fi

    log_step "Verifying checksum..."

    local checksum_url="${RELEASES_URL}/download/v${version}/giil.sha256"
    local expected_checksum=""

    if command -v curl &> /dev/null; then
        expected_checksum=$(curl -fsSL --connect-timeout 5 "$checksum_url" 2>/dev/null | tr -d '[:space:]')
    elif command -v wget &> /dev/null; then
        expected_checksum=$(wget -qO- --timeout=5 "$checksum_url" 2>/dev/null | tr -d '[:space:]')
    fi

    if [[ -z "$expected_checksum" ]]; then
        log_warn "Could not fetch checksum for v${version} (release may not exist yet)"
        log_warn "Skipping verification. Run installer again after release is published."
        return 0
    fi

    local actual_checksum
    if command -v sha256sum &> /dev/null; then
        actual_checksum=$(sha256sum "$file" | awk '{print $1}')
    elif command -v shasum &> /dev/null; then
        actual_checksum=$(shasum -a 256 "$file" | awk '{print $1}')
    else
        log_warn "No sha256sum or shasum available, skipping verification"
        return 0
    fi

    if [[ "$expected_checksum" == "$actual_checksum" ]]; then
        log_info "Checksum verified: ${actual_checksum:0:16}..."
        return 0
    else
        log_error "Checksum mismatch!"
        log_error "Expected: $expected_checksum"
        log_error "Got:      $actual_checksum"
        log_error "The downloaded file may be corrupted or tampered with."
        return 1
    fi
}

# Determine install directory
get_install_dir() {
    if [[ -n "${DEST:-}" ]]; then
        echo "$DEST"
    elif [[ -n "${GIIL_SYSTEM:-}" ]]; then
        echo "/usr/local/bin"
    else
        echo "${HOME}/.local/bin"
    fi
}

# Detect user's shell config file
get_shell_config() {
    local shell_name=$(basename "${SHELL:-/bin/bash}")

    case "$shell_name" in
        zsh)
            echo "${HOME}/.zshrc"
            ;;
        bash)
            if [[ -f "${HOME}/.bashrc" ]]; then
                echo "${HOME}/.bashrc"
            elif [[ -f "${HOME}/.bash_profile" ]]; then
                echo "${HOME}/.bash_profile"
            else
                echo "${HOME}/.bashrc"
            fi
            ;;
        fish)
            echo "${HOME}/.config/fish/config.fish"
            ;;
        *)
            echo "${HOME}/.bashrc"
            ;;
    esac
}

# Add directory to PATH in shell config
add_to_path() {
    local install_dir="$1"
    local shell_config="$2"
    local shell_name=$(basename "${SHELL:-/bin/bash}")

    # Check if already in PATH
    if [[ ":$PATH:" == *":${install_dir}:"* ]]; then
        log_info "Directory already in PATH"
        return 0
    fi

    # Check if already in config
    if [[ -f "$shell_config" ]] && grep -qF "$install_dir" "$shell_config" 2>/dev/null; then
        log_info "PATH entry already in $shell_config"
        return 0
    fi

    # Ensure config directory exists (important for fish)
    local config_dir=$(dirname "$shell_config")
    if [[ ! -d "$config_dir" ]]; then
        mkdir -p "$config_dir"
    fi

    # Generate shell-appropriate PATH addition
    local path_line
    if [[ "$shell_name" == "fish" ]]; then
        path_line="fish_add_path ${install_dir}"
    else
        path_line="export PATH=\"${install_dir}:\$PATH\""
    fi

    # Add to config
    echo "" >> "$shell_config"
    echo "# Added by giil installer" >> "$shell_config"
    echo "$path_line" >> "$shell_config"

    log_info "Added ${install_dir} to PATH in ${shell_config}"
}

# Main installation
main() {
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║          giil - Get iCloud Image Link Installer              ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    local install_dir=$(get_install_dir)
    local shell_config=$(get_shell_config)
    local script_path="${install_dir}/${SCRIPT_NAME}"

    # Check for existing installation
    local installed_version=$(get_installed_version "$script_path")
    local latest_version=$(get_latest_version)
    local is_upgrade=false

    if [[ -n "$installed_version" ]]; then
        is_upgrade=true
        log_info "Current version: ${installed_version}"
    fi

    if [[ -n "$latest_version" ]]; then
        log_info "Installing version: ${latest_version}"
    fi

    if [[ "$is_upgrade" == "true" && -n "$latest_version" ]]; then
        if [[ "$installed_version" == "$latest_version" ]]; then
            log_info "Already at latest version (${latest_version})"
            log_info "Reinstalling anyway..."
        else
            log_info "Upgrading: ${installed_version} → ${latest_version}"
        fi
    fi

    log_step "Install directory: ${install_dir}"
    log_step "Shell config: ${shell_config}"

    # Create install directory if needed
    if [[ ! -d "$install_dir" ]]; then
        log_info "Creating directory: ${install_dir}"
        mkdir -p "$install_dir"
    fi

    # Check if we need sudo
    local use_sudo=""
    if [[ ! -w "$install_dir" ]]; then
        if command -v sudo &> /dev/null; then
            use_sudo="sudo"
            log_warn "Using sudo for installation to ${install_dir}"
        else
            log_error "Cannot write to ${install_dir} and sudo not available"
            exit 1
        fi
    fi

    # Download the script
    log_step "Downloading giil..."
    local tmp_file=$(mktemp)

    if command -v curl &> /dev/null; then
        curl -fsSL "${REPO_URL}/giil" -o "$tmp_file"
    elif command -v wget &> /dev/null; then
        wget -qO "$tmp_file" "${REPO_URL}/giil"
    else
        log_error "Neither curl nor wget found. Please install one of them."
        exit 1
    fi

    # Verify checksum if enabled and version is known
    if [[ -n "$latest_version" ]]; then
        if ! verify_checksum "$tmp_file" "$latest_version"; then
            rm -f "$tmp_file"
            exit 1
        fi
    fi

    # Install the script
    log_step "Installing to ${script_path}..."
    $use_sudo mv "$tmp_file" "$script_path"
    $use_sudo chmod +x "$script_path"

    # Add to PATH if needed
    if [[ -z "${GIIL_NO_ALIAS:-}" ]]; then
        add_to_path "$install_dir" "$shell_config"
    fi

    # Verify installation
    if [[ -x "$script_path" ]]; then
        echo ""
        log_info "✓ Installation complete!"
        echo ""
        echo -e "${GREEN}To start using giil:${NC}"
        echo ""

        if [[ ":$PATH:" != *":${install_dir}:"* ]]; then
            echo -e "  ${BOLD}1. Reload your shell:${NC}"
            echo -e "     source ${shell_config}"
            echo ""
            echo -e "  ${BOLD}2. Or start a new terminal, then run:${NC}"
        else
            echo -e "  ${BOLD}Run:${NC}"
        fi

        echo -e "     giil \"https://share.icloud.com/photos/YOUR_PHOTO_ID\""
        echo ""
        echo -e "${YELLOW}First run will install Playwright + Chromium (~200MB)${NC}"
        echo ""
    else
        log_error "Installation failed - script not executable"
        exit 1
    fi
}

main "$@"
