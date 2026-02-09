#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Output colored progress information
print_progress() {
    echo -e "${BLUE}[Build Progress]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[Success]${NC} $1"
}


print_progress "Starting to build @we-dev-client..."

# Execute build command
pnpm build:client

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Error: Build failed"
    exit 1
fi

print_success "Build completed"
print_progress "Preparing to move files..."


print_progress "Cleaning old files..."

# Clean target directory
# rm -rf apps/we-dev-next/public/wedev_public/*

print_progress "Moving files..."

# Move all files from dist directory to public/wedev_public
mv apps/we-dev-client/dist/* apps/we-dev-next/public/wedev_public/

# Check if move was successful
if [ $? -ne 0 ]; then
    echo "Error: Failed to move files"
    exit 1
fi

print_success "File move completed"
print_success "All operations completed!"

# Display results
echo -e "\n${GREEN}Build results:${NC}"
echo "Files have been moved to: apps/we-dev-next/public/wedev_public/"

print_progress "Checking resource references in index.html..."

# Read index.html file
INDEX_FILE="apps/we-dev-next/public/wedev_public/index.html"
if [ -f "$INDEX_FILE" ]; then
    print_progress "Replacing resource paths..."

    # Create temporary file
    TEMP_FILE="${INDEX_FILE}.tmp"

    # Use sed to replace ./assets with wedev_public/assets
    sed 's|"./assets|"wedev_public/assets|g' "$INDEX_FILE" > "$TEMP_FILE"

    # Move temporary file back to original file
    mv "$TEMP_FILE" "$INDEX_FILE"

    # Display replacement results
    FOUND_ASSETS=$(grep -o 'wedev_public/assets[^"]*' "$INDEX_FILE" || true)

    if [ ! -z "$FOUND_ASSETS" ]; then
        print_success "Resource paths updated, current references are:"
        echo "$FOUND_ASSETS"
    else
        echo -e "${BLUE}No resource references found${NC}"
    fi
else
    echo "Error: index.html file does not exist"
fi
