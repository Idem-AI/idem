#!/bin/bash

# Idem workspace package.json validation script
# Usage: ./scripts/check-packages.sh

echo "🔍 Checking package.json files for issues..."
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

ISSUES_FOUND=0

# Function to check a package.json file
check_package_json() {
    local file=$1
    local dir=$(dirname "$file")
    
    info "Checking $file..."
    
    # Check if file is valid JSON
    if ! jq empty "$file" 2>/dev/null; then
        error "Invalid JSON in $file"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        return
    fi
    
    # Check for version field
    if ! jq -e '.version' "$file" >/dev/null 2>&1; then
        warning "Missing version field in $file"
    else
        version=$(jq -r '.version' "$file")
        # Check if version is valid (not empty, not just spaces)
        if [[ -z "$version" || "$version" =~ ^[[:space:]]*$ ]]; then
            error "Invalid or empty version in $file: '$version'"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    fi
    
    # Check for invalid dependency versions (with leading/trailing spaces)
    if jq -e '.dependencies' "$file" >/dev/null 2>&1; then
        while IFS= read -r dep; do
            version=$(jq -r ".dependencies[\"$dep\"]" "$file")
            if [[ "$version" =~ ^[[:space:]] || "$version" =~ [[:space:]]$ ]]; then
                error "Invalid version with spaces in $file: $dep = '$version'"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        done < <(jq -r '.dependencies | keys[]' "$file")
    fi
    
    # Check for invalid devDependency versions
    if jq -e '.devDependencies' "$file" >/dev/null 2>&1; then
        while IFS= read -r dep; do
            version=$(jq -r ".devDependencies[\"$dep\"]" "$file")
            if [[ "$version" =~ ^[[:space:]] || "$version" =~ [[:space:]]$ ]]; then
                error "Invalid version with spaces in $file: $dep = '$version'"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        done < <(jq -r '.devDependencies | keys[]' "$file")
    fi
    
    # Check for name field
    if ! jq -e '.name' "$file" >/dev/null 2>&1; then
        warning "Missing name field in $file"
    fi
    
    success "Checked $file"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    error "jq is not installed. Please install jq to run this script."
    echo "  macOS: brew install jq"
    echo "  Linux: apt-get install jq or yum install jq"
    exit 1
fi

# Check root package.json
if [ -f "package.json" ]; then
    check_package_json "package.json"
fi

# Check packages
for pkg in packages/*/package.json; do
    if [ -f "$pkg" ]; then
        check_package_json "$pkg"
    fi
done

# Check apps (excluding vendor directories)
for app in apps/*/package.json; do
    if [ -f "$app" ] && [[ ! "$app" =~ vendor ]]; then
        check_package_json "$app"
    fi
done

# Check appgen sub-apps
for app in apps/appgen/apps/*/package.json; do
    if [ -f "$app" ]; then
        check_package_json "$app"
    fi
done

echo ""
if [ $ISSUES_FOUND -eq 0 ]; then
    success "🎉 No issues found in package.json files!"
else
    error "Found $ISSUES_FOUND issue(s) in package.json files"
    echo ""
    info "Please fix the issues above before running npm install"
    exit 1
fi
echo ""
