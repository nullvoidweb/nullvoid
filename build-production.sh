#!/bin/bash

# NULL VOID Production Build Script
# This script builds the extension for production deployment

echo "🚀 Building NULL VOID Extension for Production..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

# Build Chrome version
echo "📦 Building Chrome version..."
node build.js chrome

# Build Firefox version
echo "📦 Building Firefox version..."  
node build.js firefox

# Create production package
echo "📦 Creating production package..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "builds/production_${TIMESTAMP}"

# Copy built extension
cp -r src/ "builds/production_${TIMESTAMP}/nullvoid-chrome/"
cp -r src/ "builds/production_${TIMESTAMP}/nullvoid-firefox/"

# Copy Firefox manifest
cp src/manifests/firefox.json "builds/production_${TIMESTAMP}/nullvoid-firefox/manifest.json"

# Copy documentation
cp PRODUCTION-CONFIG.md "builds/production_${TIMESTAMP}/"
cp README.md "builds/production_${TIMESTAMP}/"

echo "✅ Production build completed!"
echo "📁 Build location: builds/production_${TIMESTAMP}/"
echo ""
echo "🔧 Next steps:"
echo "1. Test the extension in Chrome and Firefox"
echo "2. Deploy RBI backend services"
echo "3. Update DNS records for RBI endpoints"
echo "4. Submit to Chrome Web Store and Firefox Add-ons"
echo ""
echo "🌐 Production endpoints:"
echo "- https://sg-rbi-api.nullvoid.com"
echo "- https://us-rbi-api.nullvoid.com" 
echo "- https://uk-rbi-api.nullvoid.com"
echo "- https://ca-rbi-api.nullvoid.com"
