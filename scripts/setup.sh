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
echo -e "${BLUE}🚀  IDEM Workspace - Setup & Configuration         ${NC}"
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

error() {
  echo -e "${RED}error:${NC} $1"
  exit 1
}

# --- Step 1: Check Prerequisites ---
info "Verifying prerequisites..."

# Node.js check
if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Please install Node.js >= 18."
fi
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node.js version is $NODE_VERSION. Recommended version is >= 18."
else
  success "Node.js version $NODE_VERSION is active."
fi

# npm check
if ! command -v npm &> /dev/null; then
  error "npm is not installed."
fi
NPM_VERSION=$(npm -v)
NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d'.' -f1)
if [ "$NPM_MAJOR" -lt 9 ]; then
  warn "npm version is $NPM_VERSION. Recommended version is >= 9."
else
  success "npm version $NPM_VERSION is active."
fi

# pnpm check
if ! command -v pnpm &> /dev/null; then
  warn "pnpm is not installed globally. Attempting to install pnpm..."
  npm install -g pnpm || error "Failed to install pnpm globally. Please install manually: npm install -g pnpm"
fi
success "pnpm version $(pnpm -v) is active."

# Docker check (not critical for installation, but needed for compose run)
if ! command -v docker &> /dev/null; then
  warn "Docker is not currently running or installed. You will need Docker to run the docker-compose environment."
else
  success "Docker is installed."
fi

# --- Step 2: Install root & workspace dependencies ---
info "Installing root and npm workspace dependencies..."
npm install
success "Workspace dependencies successfully installed."

# --- Step 3: Compile shared packages ---
info "Compiling shared packages..."
npm run prepare:packages || error "Failed to compile shared packages."
success "Shared packages compiled successfully."

# --- Step 4: Install app-specific dependencies using pnpm ---
if [ -d "apps/chart" ]; then
  info "Installing Diagram Editor dependencies (apps/chart)..."
  (cd apps/chart && pnpm install) || error "Failed to install Diagram Editor dependencies."
  success "Diagram Editor setup complete."
else
  warn "apps/chart directory not found. Skipping."
fi

if [ -d "apps/appgen" ]; then
  info "Installing App Generator dependencies (apps/appgen)..."
  (cd apps/appgen && pnpm install) || error "Failed to install App Generator dependencies."
  success "App Generator setup complete."
else
  warn "apps/appgen directory not found. Skipping."
fi

# --- Step 5: Check and configure environment files ---
info "Configuring environment files..."

# Root .env check
if [ ! -f ".env.dev" ]; then
  warn "Root .env.dev was not found. Please ensure it is present for Docker configuration."
fi

# API environment setup
if [ -d "apps/api" ]; then
  if [ ! -f "apps/api/.env" ]; then
    info "Setting up default environment for apps/api..."
    touch apps/api/.env
    success "Created apps/api/.env file."
  fi
fi

# iDeploy environment setup
if [ -d "apps/ideploy" ]; then
  if [ ! -f "apps/ideploy/.env" ]; then
    info "Setting up default environment for apps/ideploy..."
    if [ -f "apps/ideploy/.env.idem.example" ]; then
      cp apps/ideploy/.env.idem.example apps/ideploy/.env
      success "Created apps/ideploy/.env from example."
    elif [ -f "apps/ideploy/.env.development.example" ]; then
      cp apps/ideploy/.env.development.example apps/ideploy/.env
      success "Created apps/ideploy/.env from example."
    else
      touch apps/ideploy/.env
      success "Created empty apps/ideploy/.env file."
    fi
  fi
fi

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}🎉  IDEM Workspace setup finished successfully!   ${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
info "To start the development environment using Docker Compose:"
echo "   docker compose -f docker-compose.dev.yml up --build -d"
echo ""
info "To run applications individually without Docker:"
echo "   npm run dev:dashboard       # Angular main dashboard"
echo "   npm run dev:api             # Express API backend"
echo "   npm run dev:chart           # Svelte Mermaid diagram editor"
echo "   npm run dev:appgen-client   # React App Generator client"
echo ""
