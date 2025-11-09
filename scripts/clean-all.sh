#!/bin/bash

# Idem workspace complete cleanup script
# Usage: ./scripts/clean-all.sh

set -e

echo "🧹 Cleaning Idem workspace..."
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

# Clean root
info "Cleaning root workspace..."
rm -rf node_modules package-lock.json pnpm-lock.yaml
success "Root cleaned"

# Clean packages
info "Cleaning packages..."
for pkg in packages/*; do
    if [ -d "$pkg" ]; then
        info "Cleaning $(basename $pkg)..."
        rm -rf "$pkg/node_modules" "$pkg/package-lock.json" "$pkg/dist" "$pkg/tsconfig.tsbuildinfo"
    fi
done
success "Packages cleaned"

# Clean apps
info "Cleaning apps..."

# landing
if [ -d "apps/landing" ]; then
    info "Cleaning landing..."
    rm -rf apps/landing/node_modules apps/landing/package-lock.json apps/landing/dist apps/landing/.angular
fi

# main-dashboard
if [ -d "apps/main-dashboard" ]; then
    info "Cleaning main-dashboard..."
    rm -rf apps/main-dashboard/node_modules apps/main-dashboard/package-lock.json apps/main-dashboard/dist apps/main-dashboard/.angular
fi

# api
if [ -d "apps/api" ]; then
    info "Cleaning api..."
    rm -rf apps/api/node_modules apps/api/package-lock.json apps/api/dist
fi

# chart
if [ -d "apps/chart" ]; then
    info "Cleaning chart..."
    rm -rf apps/chart/node_modules apps/chart/pnpm-lock.yaml apps/chart/.svelte-kit apps/chart/build
fi

# appgen
if [ -d "apps/appgen" ]; then
    info "Cleaning appgen..."
    rm -rf apps/appgen/node_modules apps/appgen/package-lock.json
    
    if [ -d "apps/appgen/apps/we-dev-next" ]; then
        info "Cleaning appgen we-dev-next..."
        rm -rf apps/appgen/apps/we-dev-next/node_modules apps/appgen/apps/we-dev-next/pnpm-lock.yaml apps/appgen/apps/we-dev-next/.next
    fi
    
    if [ -d "apps/appgen/apps/we-dev-client" ]; then
        info "Cleaning appgen we-dev-client..."
        rm -rf apps/appgen/apps/we-dev-client/node_modules apps/appgen/apps/we-dev-client/pnpm-lock.yaml apps/appgen/apps/we-dev-client/dist
    fi
fi

success "Apps cleaned"

echo ""
success "🎉 Cleanup completed successfully!"
echo ""
info "Next steps:"
echo "  1. Run: ./scripts/setup.sh"
echo "  2. Or run: npm install"
echo ""
