#!/bin/bash

# NULL VOID Smart Integration Production Build Script
# This script packages the extension for Chrome Web Store distribution

echo "🚀 Starting NULL VOID Smart Integration Production Build..."

# Set version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "📦 Building version: $VERSION"

# Create build directory
BUILD_DIR="dist/null-void-v$VERSION"
rm -rf dist
mkdir -p "$BUILD_DIR"

echo "📁 Copying extension files..."

# Copy core extension files
cp src/manifest.json "$BUILD_DIR/"
cp src/background.js "$BUILD_DIR/"
cp src/popup.html "$BUILD_DIR/"
cp src/popup.css "$BUILD_DIR/"
cp src/popup.js "$BUILD_DIR/"
cp src/options.html "$BUILD_DIR/"
cp src/options.js "$BUILD_DIR/"

# Copy RBI browser files
cp src/rbi-browser.html "$BUILD_DIR/"
cp src/rbi-browser.js "$BUILD_DIR/"
cp src/ephemeral-browser.html "$BUILD_DIR/"
cp src/ephemeral-browser.js "$BUILD_DIR/"
cp src/file-viewer.html "$BUILD_DIR/"
cp src/file-viewer.js "$BUILD_DIR/"

# Copy common directory
mkdir -p "$BUILD_DIR/common"
cp src/common/*.js "$BUILD_DIR/common/"

# Copy icons
mkdir -p "$BUILD_DIR/icons"
cp src/icons/*.png "$BUILD_DIR/icons/"

# Copy Smart Integration security content script
cp src/smart-integration-security.js "$BUILD_DIR/"

echo "🔧 Processing production optimizations..."

# Update manifest for production
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$BUILD_DIR/manifest.json', 'utf8'));
manifest.version = '$VERSION';
// Remove development flags if any
delete manifest.key;
fs.writeFileSync('$BUILD_DIR/manifest.json', JSON.stringify(manifest, null, 2));
console.log('✅ Manifest updated for production');
"

# Minify JavaScript files (basic optimization)
echo "📉 Optimizing JavaScript files..."
for jsfile in "$BUILD_DIR"/*.js "$BUILD_DIR"/common/*.js; do
    if [ -f "$jsfile" ]; then
        # Basic minification - remove console.log statements in production
        sed -i.bak '/console\.log/d' "$jsfile" && rm "$jsfile.bak"
    fi
done

# Create Chrome extension package
echo "📦 Creating Chrome extension package..."
cd dist
zip -r "null-void-smart-integration-v$VERSION.zip" "null-void-v$VERSION/"
cd ..

# Create Firefox package
echo "🦊 Creating Firefox package..."
cp -r "$BUILD_DIR" "dist/null-void-firefox-v$VERSION"
cd dist
zip -r "null-void-smart-integration-firefox-v$VERSION.zip" "null-void-firefox-v$VERSION/"
cd ..

# Generate checksums
echo "🔐 Generating checksums..."
cd dist
sha256sum *.zip > checksums.txt
cd ..

echo "✅ Build completed successfully!"
echo ""
echo "📋 Build Summary:"
echo "  Version: $VERSION"
echo "  Chrome Package: dist/null-void-smart-integration-v$VERSION.zip"
echo "  Firefox Package: dist/null-void-smart-integration-firefox-v$VERSION.zip"
echo "  Checksums: dist/checksums.txt"
echo ""
echo "🚀 Ready for Chrome Web Store and Firefox Add-ons distribution!"
echo ""
echo "📚 Next Steps:"
echo "  1. Test the packaged extension in Chrome/Firefox"
echo "  2. Upload to Chrome Web Store Developer Dashboard"
echo "  3. Submit to Firefox Add-ons (AMO)"
echo "  4. Update version in package.json for next release"
echo ""
echo "🔗 Useful Links:"
echo "  Chrome Web Store: https://chrome.google.com/webstore/developer/dashboard"
echo "  Firefox Add-ons: https://addons.mozilla.org/developers/"

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
