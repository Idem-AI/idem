#!/bin/bash

# Fix dependencies script for appgen client
echo "🔧 Fixing dependencies for appgen client..."

# Remove node_modules and lock file
echo "📦 Cleaning node_modules and lock files..."
rm -rf node_modules
rm -f pnpm-lock.yaml
rm -f package-lock.json

# Clear pnpm cache
echo "🧹 Clearing pnpm cache..."
pnpm store prune

# Reinstall dependencies
echo "📥 Reinstalling dependencies..."
pnpm install

echo "✅ Dependencies fixed! You can now run 'pnpm dev' to start the development server."
