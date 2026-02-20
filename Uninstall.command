#!/bin/bash
# Created by Cooper Santillan 
# eSpace Digital Kiosk - Uninstaller (Refined)

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Uninstaller"
echo "------------------------------------------"

SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# Dynamically find Caddy path based on Homebrew installation
if command -v brew &> /dev/null; then
    BREW_PREFIX=$(brew --prefix)
    CADDY_CONFIG="$BREW_PREFIX/etc/Caddyfile"
else
    CADDY_CONFIG="/opt/homebrew/etc/Caddyfile"
fi

# 1. Stop and Unload the Kiosk service
echo "🛑 Stopping background Kiosk service..."
launchctl unload "$PLIST_PATH" 2>/dev/null

# 2. Stop and Cleanup Caddy
if command -v caddy &> /dev/null; then
    echo "🔒 Stopping Caddy Port 80 proxy (requires sudo)..."
    sudo brew services stop caddy 2>/dev/null
    
    if [ -f "$CADDY_CONFIG" ]; then
        sudo rm "$CADDY_CONFIG"
        echo "🗑️  Removed Caddy configuration: $CADDY_CONFIG"
    fi
fi

# 3. Kill lingering processes
# We search for the specific path to ensure we don't kill other Node apps
echo "🧹 Killing any lingering kiosk processes..."
pkill -f "$INSTALL_DIR" 2>/dev/null

# 4. Remove Files
[ -f "$PLIST_PATH" ] && rm "$PLIST_PATH" && echo "🗑️  Removed LaunchAgent"
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR" && echo "🗑️  Removed Application Files"

# 5. Clean up logs
rm /tmp/espace_kiosk.err 2>/dev/null
rm /tmp/espace_kiosk.out 2>/dev/null

echo "------------------------------------------"
echo "✅ UNINSTALL COMPLETE"
echo "The kiosk server and Port 80 proxy have been removed."
echo "------------------------------------------"
read -p "Press Enter to close..."
exit 0