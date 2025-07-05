#!/bin/bash

# Build script for integrated aVOIDgame.io platform
echo "Building integrated platform..."

# Navigate to hub platform directory
cd aVOIDgame-hub/avoidgame-hub-platform

# Install dependencies and build hub platform
echo "Building hub platform..."
npm install
npm run build

# Create VOIDaVOID subdirectory
echo "Creating VOIDaVOID subdirectory..."
mkdir -p dist/VOIDaVOID

# Copy VOIDaVOID game files
echo "Copying VOIDaVOID game files..."
cp -r ../../VOIDaVOID/dist/* dist/VOIDaVOID/

echo "Build completed successfully!" 