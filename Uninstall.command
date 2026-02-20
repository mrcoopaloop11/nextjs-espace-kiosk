#!/bin/bash
# Created by Cooper Santillan 
# eSpace Digital Kiosk - Super Uninstaller (Prompt Once)

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Uninstaller"
echo "------------------------------------------"

# 1. Ask for Admin Credentials Upfront for cleanup
echo "Administrator credentials are required to stop the global proxy service."
read -p "Admin Username: " ADMIN_USER
read -s -p "Admin Password: " ADMIN_PASS
echo ""
echo ""

# Verify the user exists locally
if ! id "$ADMIN_USER" &>/dev/null; then
    echo "❌ Error: User '$ADMIN_USER' not found on this Mac."
    read -p "Press Enter to exit..."
    exit 1
fi

# Verify the password and admin privileges immediately
echo "🔐 Verifying credentials..."
if ! osascript -e "do shell script \"echo ok\" user name \"$ADMIN_USER\" password \"$ADMIN_PASS\" with administrator privileges" &>/dev/null; then
    echo "❌ Error: Invalid password or '$ADMIN_USER' is not an Administrator."
    read -p "Press Enter to exit..."
    exit 1
fi
echo "✅ Credentials accepted."

# 2. Command Wrapper for Root execution
run_root() {
    local cmd="cd /tmp && $1" 
    local escaped=$(echo "$cmd" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    osascript -e "do shell script \"$escaped\" user name \"$ADMIN_USER\" password \"$ADMIN_PASS\" with administrator privileges"
}

# 3. Paths and Environment
SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# Detect Brew Path dynamically
if [[ $(uname -m) == "arm64" ]]; then
    BREW_PREFIX="/opt/homebrew"
else
    BREW_PREFIX="/usr/local"
fi
BREW_BIN="$BREW_PREFIX/bin/brew"
CADDY_CONFIG="$BREW_PREFIX/etc/Caddyfile"

# 4. Stop and Unload the Kiosk service (Local User task)
echo "🛑 Stopping background Kiosk service..."
launchctl unload "$PLIST_PATH" 2>/dev/null

# 5. Stop and Cleanup Caddy (Global Root task)
if [ -f "$BREW_BIN" ]; then
    echo "🔒 Stopping Caddy proxy..."
    # The '|| true' prevents the script from crashing if Caddy is already stopped
    run_root "$BREW_BIN services stop caddy || true"
    
    if [ -f "$CADDY_CONFIG" ]; then
        run_root "rm -f $CADDY_CONFIG"
        echo "🗑️  Removed Caddy configuration: $CADDY_CONFIG"
    fi
fi

# 6. Kill lingering processes (Local User task)
echo "🧹 Killing any lingering kiosk processes..."
pkill -f "$INSTALL_DIR" 2>/dev/null

# 7. Remove Files (Local User task)
[ -f "$PLIST_PATH" ] && rm "$PLIST_PATH" && echo "🗑️  Removed LaunchAgent"
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR" && echo "🗑️  Removed Application Files"

# 8. Clean up logs
rm /tmp/espace_kiosk.err 2>/dev/null
rm /tmp/espace_kiosk.out 2>/dev/null

echo "------------------------------------------"
echo "✅ UNINSTALL COMPLETE"
echo "The kiosk server and proxy have been removed."
echo "------------------------------------------"
read -p "Press Enter to close..."
exit 0