#!/bin/bash
# Apply patches to node_modules after installation
# This script is run automatically by the postinstall hook

set -e

# Check if patches directory exists
if [ ! -d "patches" ]; then
  echo "No patches directory found, skipping patch application"
  exit 0
fi

# Function to find the esrap package directory
find_esrap_dir() {
  # Try bun's directory structure first
  if [ -d "node_modules/.bun/esrap@2.2.1/node_modules/esrap" ]; then
    echo "node_modules/.bun/esrap@2.2.1/node_modules/esrap"
    return 0
  fi
  
  # Try standard node_modules structure
  if [ -d "node_modules/esrap" ]; then
    echo "node_modules/esrap"
    return 0
  fi
  
  # Try pnpm structure
  if [ -d "node_modules/.pnpm/esrap@2.2.1/node_modules/esrap" ]; then
    echo "node_modules/.pnpm/esrap@2.2.1/node_modules/esrap"
    return 0
  fi
  
  return 1
}

# Apply esrap patch
if [ -f "patches/esrap@2.2.1.patch" ]; then
  ESRAP_DIR=$(find_esrap_dir)
  if [ $? -eq 0 ]; then
    echo "Applying esrap@2.2.1 patch to $ESRAP_DIR..."
    patch -p1 -d "$ESRAP_DIR" < patches/esrap@2.2.1.patch
    echo "✓ esrap patch applied successfully"
  else
    echo "Warning: esrap package not found in node_modules, patch not applied"
    exit 0
  fi
else
  echo "No esrap patch found, skipping"
fi
