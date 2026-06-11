#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for formatting output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🧹  IDEM Workspace - Clean & Reset                 ${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

# Helper logging functions
info() {
  echo -e "${BLUE}info:${NC} $1"
}

success() {
  echo -e "${GREEN}success:${NC} $1"
}

warn() {
  echo -e "${YELLOW}warning:${NC} $1"
}

# --- Step 1: Clean Root Workspace ---
info "Cleaning workspace root..."
rm -rf node_modules package-lock.json
success "Root node_modules and package-lock.json removed."

# --- Step 2: Clean Sub-projects ---
info "Cleaning sub-projects..."

PROJECTS=(
  "apps/api"
  "apps/appgen"
  "apps/chart"
  "apps/ideploy"
  "apps/landing"
  "apps/main-dashboard"
  "packages/shared-models"
  "packages/shared-auth-client"
  "packages/shared-styles"
)

for proj in "${PROJECTS[@]}"; do
  if [ -d "$proj" ]; then
    info "Cleaning $proj..."
    rm -rf "$proj/node_modules"
    rm -rf "$proj/dist"
    rm -rf "$proj/.next"
    rm -rf "$proj/.svelte-kit"
    rm -rf "$proj/build"
    rm -rf "$proj/package-lock.json"
    rm -rf "$proj/pnpm-lock.yaml"
    success "$proj cleaned."
  fi
done

# Clean we-dev apps inside apps/appgen/apps
if [ -d "apps/appgen/apps" ]; then
  info "Cleaning appgen sub-projects in apps/appgen/apps..."
  find apps/appgen/apps -type d -name "node_modules" -prune -exec rm -rf {} +
  find apps/appgen/apps -type d -name ".next" -prune -exec rm -rf {} +
  find apps/appgen/apps -type d -name "dist" -prune -exec rm -rf {} +
  success "appgen sub-projects cleaned."
fi

# Clean Laravel framework cache and logs for ideploy if appropriate
if [ -d "apps/ideploy" ]; then
  info "Cleaning iDeploy storage directories..."
  # Clean storage subfolders but keep .gitignore files
  find apps/ideploy/storage/logs -mindepth 1 -not -name '.gitignore' -exec rm -rf {} + 2>/dev/null || true
  find apps/ideploy/storage/framework/cache -mindepth 1 -not -name '.gitignore' -exec rm -rf {} + 2>/dev/null || true
  find apps/ideploy/storage/framework/views -mindepth 1 -not -name '.gitignore' -exec rm -rf {} + 2>/dev/null || true
  find apps/ideploy/storage/framework/sessions -mindepth 1 -not -name '.gitignore' -exec rm -rf {} + 2>/dev/null || true
  success "iDeploy logs and cache cleared."
fi

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}🎉  Workspace cleanup completed successfully!      ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
info "To perform a fresh install, run: ./scripts/setup.sh"
echo ""
