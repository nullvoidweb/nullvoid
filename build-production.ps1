# NULL VOID Smart Integration Production Build Script (PowerShell)
# This script packages the extension for Chrome Web Store distribution

Write-Host "🚀 Starting NULL VOID Smart Integration Production Build..." -ForegroundColor Green

# Set version from package.json
$packageJson = Get-Content -Path "package.json" | ConvertFrom-Json
$VERSION = $packageJson.version
Write-Host "📦 Building version: $VERSION" -ForegroundColor Cyan

# Create build directory
$BUILD_DIR = "dist\null-void-v$VERSION"
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
New-Item -ItemType Directory -Force -Path $BUILD_DIR | Out-Null

Write-Host "📁 Copying extension files..." -ForegroundColor Yellow

# Copy core extension files
Copy-Item "src\manifest.json" "$BUILD_DIR\"
Copy-Item "src\background.js" "$BUILD_DIR\"
Copy-Item "src\popup.html" "$BUILD_DIR\"
Copy-Item "src\popup.css" "$BUILD_DIR\"
Copy-Item "src\popup.js" "$BUILD_DIR\"
Copy-Item "src\options.html" "$BUILD_DIR\"
Copy-Item "src\options.js" "$BUILD_DIR\"

# Copy RBI browser files
Copy-Item "src\rbi-browser.html" "$BUILD_DIR\"
Copy-Item "src\rbi-browser.js" "$BUILD_DIR\"
Copy-Item "src\ephemeral-browser.html" "$BUILD_DIR\"
Copy-Item "src\ephemeral-browser.js" "$BUILD_DIR\"
Copy-Item "src\file-viewer.html" "$BUILD_DIR\"
Copy-Item "src\file-viewer.js" "$BUILD_DIR\"

# Copy common directory
New-Item -ItemType Directory -Force -Path "$BUILD_DIR\common" | Out-Null
Copy-Item "src\common\*" "$BUILD_DIR\common\"

# Copy icons
New-Item -ItemType Directory -Force -Path "$BUILD_DIR\icons" | Out-Null
Copy-Item "src\icons\*.png" "$BUILD_DIR\icons\"

# Copy Smart Integration security content script
Copy-Item "src\smart-integration-security.js" "$BUILD_DIR\"

Write-Host "🔧 Processing production optimizations..." -ForegroundColor Yellow

# Update manifest for production
$manifestPath = "$BUILD_DIR\manifest.json"
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$manifest.version = $VERSION
# Remove development flags if any
$manifest.PSObject.Properties.Remove('key')
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath
Write-Host "✅ Manifest updated for production" -ForegroundColor Green

# Basic optimization - remove console.log statements
Write-Host "📉 Optimizing JavaScript files..." -ForegroundColor Yellow
Get-ChildItem -Path $BUILD_DIR -Recurse -Filter "*.js" | ForEach-Object {
    $content = Get-Content $_.FullName
    $optimizedContent = $content | Where-Object { $_ -notmatch "console\.log" }
    $optimizedContent | Set-Content $_.FullName
}

# Create Chrome extension package
Write-Host "📦 Creating Chrome extension package..." -ForegroundColor Yellow
$chromeZip = "dist\null-void-smart-integration-v$VERSION.zip"
if (Get-Command "7z" -ErrorAction SilentlyContinue) {
    & 7z a -tzip $chromeZip "$BUILD_DIR\*"
} elseif (Get-Command "Compress-Archive" -ErrorAction SilentlyContinue) {
    Compress-Archive -Path "$BUILD_DIR\*" -DestinationPath $chromeZip -Force
} else {
    Write-Host "⚠️ No compression tool found. Please install 7-Zip or use PowerShell 5.0+" -ForegroundColor Yellow
}

# Create Firefox package
Write-Host "🦊 Creating Firefox package..." -ForegroundColor Yellow
$firefoxDir = "dist\null-void-firefox-v$VERSION"
Copy-Item -Recurse $BUILD_DIR $firefoxDir
$firefoxZip = "dist\null-void-smart-integration-firefox-v$VERSION.zip"
if (Get-Command "7z" -ErrorAction SilentlyContinue) {
    & 7z a -tzip $firefoxZip "$firefoxDir\*"
} elseif (Get-Command "Compress-Archive" -ErrorAction SilentlyContinue) {
    Compress-Archive -Path "$firefoxDir\*" -DestinationPath $firefoxZip -Force
}

# Generate checksums
Write-Host "🔐 Generating checksums..." -ForegroundColor Yellow
$checksums = @()
Get-ChildItem "dist\*.zip" | ForEach-Object {
    $hash = Get-FileHash $_.FullName -Algorithm SHA256
    $checksums += "$($hash.Hash.ToLower()) *$($_.Name)"
}
$checksums | Out-File "dist\checksums.txt" -Encoding UTF8

Write-Host ""
Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Build Summary:" -ForegroundColor Cyan
Write-Host "  Version: $VERSION" -ForegroundColor White
Write-Host "  Chrome Package: dist\null-void-smart-integration-v$VERSION.zip" -ForegroundColor White
Write-Host "  Firefox Package: dist\null-void-smart-integration-firefox-v$VERSION.zip" -ForegroundColor White
Write-Host "  Checksums: dist\checksums.txt" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Ready for Chrome Web Store and Firefox Add-ons distribution!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test the packaged extension in Chrome/Firefox" -ForegroundColor White
Write-Host "  2. Upload to Chrome Web Store Developer Dashboard" -ForegroundColor White
Write-Host "  3. Submit to Firefox Add-ons (AMO)" -ForegroundColor White
Write-Host "  4. Update version in package.json for next release" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "  Chrome Web Store: https://chrome.google.com/webstore/developer/dashboard" -ForegroundColor Blue
Write-Host "  Firefox Add-ons: https://addons.mozilla.org/developers/" -ForegroundColor Blue
