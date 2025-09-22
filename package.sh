#!/bin/bash

# Little Readers UG Plugin Packaging Script
# Creates a distribution-ready ZIP file

echo "📦 Creating Little Readers UG Plugin Package..."

# Define variables
PLUGIN_NAME="little-readers-plugin"
VERSION="1.0.0"
PACKAGE_NAME="little-readers-ug-v${VERSION}"

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="${TEMP_DIR}/${PACKAGE_NAME}"

echo "📁 Creating package directory: ${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}"

# Copy plugin files
echo "📋 Copying plugin files..."
cp -r "${PLUGIN_NAME}" "${PACKAGE_DIR}/"

# Copy documentation
echo "📄 Copying documentation..."
cp README.md "${PACKAGE_DIR}/"
cp -r screenshots "${PACKAGE_DIR}/" 2>/dev/null || echo "ℹ️  No screenshots directory found"

# Create installation instructions
echo "📝 Creating installation instructions..."
cat > "${PACKAGE_DIR}/INSTALLATION.md" << EOF
# Little Readers UG Plugin Installation

## Quick Start

1. Download the plugin ZIP file
2. In WordPress admin, go to Plugins > Add New
3. Click "Upload Plugin" and select the ZIP file
4. Activate the plugin
5. Go to Settings > Little Readers to configure
6. Add \`[little_readers_store]\` shortcode to your page

## Configuration

- **Backend URL**: Your Google Apps Script web app URL
- **API Key**: Your API key (default: LRU_WebApp_Key_2025)

## Support

For help and support, visit the plugin documentation or contact support.
EOF

# Create changelog
echo "📅 Creating changelog..."
cat > "${PACKAGE_DIR}/CHANGELOG.md" << EOF
# Changelog

## Version 1.0.0 ($(date +%Y-%m-%d))

### Added
- Initial release of Little Readers UG WordPress plugin
- Complete bookstore functionality with Google Apps Script integration
- Shopping cart with persistent storage
- Checkout system with delivery options
- Promo code support with discount calculations
- Responsive design for all devices
- Caching system for performance optimization
- Admin configuration panel
- WhatsApp integration for customer support

### Features
- Book grid with filtering and search
- Dynamic delivery area selection
- Order processing and SMS notifications
- Mobile-friendly responsive design
- Security features and input sanitization
EOF

# Create package info
echo "ℹ️ Creating package info..."
cat > "${PACKAGE_DIR}/package-info.txt" << EOF
Package: Little Readers UG WordPress Plugin
Version: ${VERSION}
Created: $(date)
Contains:
- WordPress plugin files
- Documentation
- Installation instructions
- Changelog

Installation:
1. Upload to WordPress plugins directory
2. Activate through WordPress admin
3. Configure settings
4. Add shortcode to pages
EOF

# Create ZIP package
echo "🗜️  Creating ZIP package..."
cd "${TEMP_DIR}"
zip -r "${PACKAGE_NAME}.zip" "${PACKAGE_NAME}/" > /dev/null

# Move package to current directory
mv "${PACKAGE_NAME}.zip" "${OLDPWD}/"

# Cleanup
rm -rf "${TEMP_DIR}"

echo "✅ Package created successfully: ${PACKAGE_NAME}.zip"
echo "📦 Package contents:"
echo "   - Plugin files"
echo "   - Documentation (README.md)"
echo "   - Installation guide"
echo "   - Changelog"
echo ""
echo "🚀 Ready for distribution!"