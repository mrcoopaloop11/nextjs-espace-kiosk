#!/bin/bash
# Created by Cooper Santillan 
# eSpace Digital Kiosk - Uninstaller

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Uninstaller"
echo "------------------------------------------"

SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# 1. Stop and Unload the service from launchctl
echo "🛑 Stopping background service..."
launchctl unload "$PLIST_PATH" 2>/dev/null

# 2. Delete the LaunchAgent Plist
if [ -f "$PLIST_PATH" ]; then
    rm "$PLIST_PATH"
    echo "🗑️  Removed LaunchAgent: $SERVICE_NAME"
fi

# 3. Delete the Application Support folder
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "🗑️  Removed application code and node_modules from Application Support"
fi

# 4. Clean up temporary logs
rm /tmp/espace_kiosk.err 2>/dev/null
rm /tmp/espace_kiosk.out 2>/dev/null

# 5. Kill any lingering Next.js processes just in case
pkill -f "next-server" 2>/dev/null

echo "------------------------------------------"
echo "✅ UNINSTALL COMPLETE"
echo "The kiosk server has been completely removed."
echo "------------------------------------------"
read -p "Press Enter to close..."