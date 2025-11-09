#!/bin/bash

# Fix permissions and rebuild packages
# Usage: ./scripts/fix-permissions-and-build.sh

set -e

echo "🔧 Fixing permissions and rebuilding packages..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Step 1: Clean old dist folders with sudo
info "Cleaning old dist folders (may require password)..."
if [ -d "packages/shared-models/dist" ]; then
    sudo rm -rf packages/shared-models/dist
    success "Cleaned shared-models/dist"
else
    info "shared-models/dist doesn't exist, skipping"
fi

if [ -d "packages/shared-auth-client/dist" ]; then
    sudo rm -rf packages/shared-auth-client/dist
    success "Cleaned shared-auth-client/dist"
else
    info "shared-auth-client/dist doesn't exist, skipping"
fi

echo ""

# Step 2: Build shared-models
info "Building @idem/shared-models..."
npm run build:shared
success "@idem/shared-models built"

echo ""

# Step 3: Verify shared-models output
info "Verifying shared-models output..."
if [ -f "packages/shared-models/dist/index.d.ts" ]; then
    success "index.d.ts exists"
    ls -lh packages/shared-models/dist/index.d.ts
else
    error "index.d.ts NOT found!"
    echo ""
    info "Listing dist contents:"
    ls -la packages/shared-models/dist/ || echo "dist folder doesn't exist"
    exit 1
fi

echo ""

# Step 4: Build shared-auth-client
info "Building @idem/shared-auth-client..."
npm run build:shared-auth
success "@idem/shared-auth-client built"

echo ""

# Step 5: Verify shared-auth-client output
info "Verifying shared-auth-client output..."
if [ -f "packages/shared-auth-client/dist/index.d.ts" ]; then
    success "index.d.ts exists"
    ls -lh packages/shared-auth-client/dist/index.d.ts
else
    error "index.d.ts NOT found!"
    echo ""
    info "Listing dist contents:"
    ls -la packages/shared-auth-client/dist/ || echo "dist folder doesn't exist"
    exit 1
fi

echo ""

# Step 6: Check file ownership
info "Checking file ownership..."
OWNER=$(ls -l packages/shared-models/dist/index.d.ts | awk '{print $3}')
if [ "$OWNER" = "$(whoami)" ]; then
    success "Files owned by $(whoami) ✓"
else
    warning "Files owned by $OWNER (should be $(whoami))"
fi

echo ""
success "🎉 All packages built successfully!"
echo ""
info "You can now run:"
echo "  npm run dev:landing"
echo "  npm run dev:dashboard"
echo ""
