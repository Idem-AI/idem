#!/bin/bash

# Idem workspace cleanup script
# Usage: ./scripts/clean.sh

set -e

echo "🧹 Cleaning Idem workspace..."
echo ""

# Colors for messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Clean root node_modules
info "Cleaning root node_modules..."
rm -rf node_modules package-lock.json
success "Root node_modules cleaned"

# Clean idem-ai
if [ -d "apps/idem-ai" ]; then
    info "Cleaning idem-ai..."
    rm -rf apps/idem-ai/node_modules
    rm -rf apps/idem-ai/dist
    rm -rf apps/idem-ai/.angular
    success "idem-ai cleaned"
fi

# Clean idemAI-api
if [ -d "apps/idemAI-api" ]; then
    info "Cleaning idem-api..."
    rm -rf apps/idemAI-api/node_modules
    rm -rf apps/idemAI-api/dist
    success "idem-api cleaned"
fi

# Clean idem-ai-chart
if [ -d "apps/idem-ai-chart" ]; then
    info "Cleaning idem-ai-chart..."
    rm -rf apps/idem-ai-chart/node_modules
    rm -rf apps/idem-ai-chart/build
    rm -rf apps/idem-ai-chart/.svelte-kit
    success "idem-ai-chart cleaned"
fi

# Clean idem-appgen
if [ -d "apps/idem-appgen" ]; then
    info "Cleaning idem-appgen..."
    rm -rf apps/idem-appgen/node_modules
    rm -rf apps/idem-appgen/apps/*/node_modules
    rm -rf apps/idem-appgen/apps/*/dist
    rm -rf apps/idem-appgen/apps/*/.next
    success "idem-appgen cleaned"
fi

# Clean coverage files
info "Cleaning coverage files..."
find . -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true
success "Coverage files cleaned"

# Clean log files
info "Cleaning log files..."
find . -type f -name "*.log" -delete 2>/dev/null || true
success "Log files cleaned"

echo ""
success "🎉 Cleanup completed!"
echo ""
info "To reinstall dependencies, run:"
echo "  ./scripts/setup.sh"
echo "  or"
echo "  npm install"
echo ""
