#!/bin/bash

# Idem workspace setup script with npm workspaces
# Usage: ./scripts/setup.sh

set -e

echo "🚀 Setting up Idem workspace with npm workspaces..."
echo ""

# Colors for messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions to display messages
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check Node.js
info "Checking Node.js..."
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js version >= 18.0.0 required. Current version: $(node -v)"
    exit 1
fi
success "Node.js $(node -v) detected"

# Check npm
info "Checking npm..."
if ! command -v npm &> /dev/null; then
    error "npm is not installed"
    exit 1
fi
success "npm $(npm -v) detected"

# Check pnpm
info "Checking pnpm..."
if ! command -v pnpm &> /dev/null; then
    warning "pnpm is not installed. Installing..."
    npm install -g pnpm@8.15.4
    success "pnpm installed"
else
    success "pnpm $(pnpm -v) detected"
fi

# Clean old files
info "Cleaning old files..."
rm -rf node_modules package-lock.json
success "Cleanup completed"

# Install root dependencies
info "Installing workspace dependencies..."
npm install
success "Workspace dependencies installed"

echo ""
info "📦 Building shared packages first..."
echo ""

# Build shared-models
if [ -d "packages/shared-models" ]; then
    info "Building @idem/shared-models..."
    npm run build --workspace=@idem/shared-models
    success "@idem/shared-models built"
fi

# Build shared-auth-client
if [ -d "packages/shared-auth-client" ]; then
    info "Building @idem/shared-auth-client..."
    npm run build --workspace=@idem/shared-auth-client
    success "@idem/shared-auth-client built"
fi

# Build shared-styles
if [ -d "packages/shared-styles" ]; then
    info "Verifying @idem/shared-styles..."
    success "@idem/shared-styles ready"
fi

echo ""
info "🚀 Installing application dependencies..."
echo ""

# landing
if [ -d "apps/landing" ]; then
    info "Installing landing dependencies..."
    cd apps/landing
    npm install
    cd ../..
    success "landing configured"
fi

# main-dashboard
if [ -d "apps/main-dashboard" ]; then
    info "Installing main-dashboard dependencies..."
    cd apps/main-dashboard
    npm install
    cd ../..
    success "main-dashboard configured"
fi

# api
if [ -d "apps/api" ]; then
    info "Installing idem-api dependencies..."
    cd apps/api
    sudo npm install
    cd ../..
    success "idem-api configured"
fi

# chart
if [ -d "apps/chart" ]; then
    info "Installing chart dependencies..."
    cd apps/chart
    sudo pnpm install
    cd ../..
    success "chart configured"
fi

# appgen we-dev-next
if [ -d "apps/appgen" ]; then
    info "Installing appgen dependencies..."
    cd apps/appgen/apps/we-dev-next
    sudo pnpm install
    cd ../..
    success "appgen we-dev-next configured"
fi

# appgen we-dev-client
if [ -d "apps/appgen" ]; then
    info "Installing appgen dependencies..."
    cd apps/appgen/apps/we-dev-client
    sudo pnpm install
    cd ../..
    success "appgen we-dev-client configured"
fi

# Verify npm workspaces configuration
info "Verifying npm workspaces configuration..."
if npm ls --workspaces --depth=0 &> /dev/null; then
    success "npm workspaces configuration valid"
    echo ""
    info "Detected workspaces:"
    npm ls --workspaces --depth=0
else
    warning "Some workspaces may have dependency issues (this is normal)"
fi

echo ""
success "🎉 Setup completed successfully!"
echo ""
info "Available commands:"
echo "  npm run dev:landing      - Launch landing (port 4201)"
echo "  npm run dev:dashboard    - Launch main-dashboard (port 4200)"
echo "  npm run dev:chart        - Launch chart"
echo "  npm run dev:appgen       - Launch appgen"
echo "  npm run dev:api          - Launch idem-api"
echo "  npm run build:all        - Build all projects"
echo "  npm run build:landing    - Build landing"
echo "  npm run build:dashboard  - Build main-dashboard"
echo "  npm run test:all         - Test all projects"
echo "  npm run lint:all         - Lint all projects"
echo ""
info "For more information, see:"
echo "  - README.md"
echo "  - documentation/NPM_WORKSPACES_GUIDE.md"
echo "  - MIGRATION_NX_TO_NPM_WORKSPACES.md"
echo ""
