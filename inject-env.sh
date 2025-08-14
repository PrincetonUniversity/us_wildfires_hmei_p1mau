#!/bin/sh

# Script to inject runtime environment variables into React build
# This replaces placeholder values in the built JavaScript files

set -e

# Define the directory containing the built React app
BUILD_DIR="/usr/share/nginx/html"

echo "=== Starting environment variable injection ==="
echo "BUILD_DIR: $BUILD_DIR"
echo "REACT_APP_MAPBOX_TOKEN: ${REACT_APP_MAPBOX_TOKEN:-''}"
echo "REACT_APP_API_BASE_URL: ${REACT_APP_API_BASE_URL:-''}"
echo "=== Listing all JS files in build directory ==="
find "$BUILD_DIR" -name "*.js" -type f | head -10

echo "=== Injecting runtime environment variables ==="

# Find all JavaScript files in the build directory and process them
find "$BUILD_DIR" -name "*.js" -type f | while read -r file; do
    echo "--- Checking file: $file ---"

    # Show file size and first few lines for context
    echo "File size: $(wc -c < "$file") bytes"
    echo "First 200 chars:"
    head -c 200 "$file"
    echo ""

    # Check if file contains any of our placeholders (with timeout)
    echo "Searching for patterns in $file:"

    # Use a faster, limited search to avoid hanging
    PLACEHOLDER_FOUND=""
    if timeout 10 grep -q "RUNTIME_API_BASE_URL_PLACEHOLDER" "$file" 2>/dev/null; then
        PLACEHOLDER_FOUND="RUNTIME_API_BASE_URL_PLACEHOLDER"
        echo "✓ Found RUNTIME_API_BASE_URL_PLACEHOLDER"
    elif timeout 10 grep -q "REACT_APP_MAPBOX_TOKEN" "$file" 2>/dev/null; then
        PLACEHOLDER_FOUND="REACT_APP_MAPBOX_TOKEN"
        echo "✓ Found REACT_APP_MAPBOX_TOKEN"
    else
        echo "⚠ No placeholders found in $file"
    fi

    if [ -n "$PLACEHOLDER_FOUND" ]; then
        echo "*** Processing file: $file ***"

        # Replace REACT_APP_MAPBOX_TOKEN
        if [ -n "$REACT_APP_MAPBOX_TOKEN" ]; then
            sed -i "s|REACT_APP_MAPBOX_TOKEN_PLACEHOLDER|$REACT_APP_MAPBOX_TOKEN|g" "$file"
            echo "✓ Injected REACT_APP_MAPBOX_TOKEN into $file"
        fi

        # Replace RUNTIME_API_BASE_URL_PLACEHOLDER with the actual API base URL
        if [ -n "$REACT_APP_API_BASE_URL" ]; then
            echo "Attempting to replace RUNTIME_API_BASE_URL_PLACEHOLDER with: $REACT_APP_API_BASE_URL"

            sed -i "s|RUNTIME_API_BASE_URL_PLACEHOLDER|$REACT_APP_API_BASE_URL|g" "$file"

            echo "✓ Injected API base URL into $file"

            # Verify the replacement worked
            if timeout 5 grep -q "$REACT_APP_API_BASE_URL" "$file" 2>/dev/null; then
                echo "✓ Verification: API base URL found in file after replacement"
            else
                echo "⚠ Verification: API base URL not found after replacement"
            fi
        else
            echo "⚠ Warning: REACT_APP_API_BASE_URL not set, using placeholder"
        fi
    else
        echo "No relevant patterns found in $file"
    fi
    echo ""
done

# Also handle any config.js file if it exists
if [ -f "$BUILD_DIR/config.js" ]; then
    echo "=== Processing config.js ==="
    if [ -n "$REACT_APP_MAPBOX_TOKEN" ]; then
        sed -i "s|REACT_APP_MAPBOX_TOKEN_PLACEHOLDER|$REACT_APP_MAPBOX_TOKEN|g" "$BUILD_DIR/config.js"
        echo "✓ Injected REACT_APP_MAPBOX_TOKEN into config.js"
    fi
    if [ -n "$REACT_APP_API_BASE_URL" ]; then
        sed -i "s|RUNTIME_API_BASE_URL_PLACEHOLDER|$REACT_APP_API_BASE_URL|g" "$BUILD_DIR/config.js"
        echo "✓ Injected REACT_APP_API_BASE_URL into config.js"
    fi
else
    echo "No config.js file found"
fi

echo "=== Environment variable injection complete ==="

# Start nginx
exec nginx -g 'daemon off;'
