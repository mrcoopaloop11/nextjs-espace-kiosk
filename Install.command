#!/bin/bash
# Created by Cooper Santillan
# eSpace Digital Kiosk - Super Installer (Prompt Once)

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Installer"
echo "------------------------------------------"

# 1. Ask for Admin Credentials Upfront
echo "To install global dependencies, please provide an Administrator account."
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

# 2. Command Wrappers
# Runs as true root (for system files and services)
run_root() {
    # cd /tmp prevents the "directory not readable" Homebrew error
    local cmd="cd /tmp && $1" 
    local escaped=$(echo "$cmd" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    osascript -e "do shell script \"$escaped\" user name \"$ADMIN_USER\" password \"$ADMIN_PASS\" with administrator privileges"
}

# Runs as the Admin user (required because Homebrew refuses to run as root)
run_admin() {
    run_root "sudo -H -u $ADMIN_USER bash -c '$1'"
}

# 3. Detect Homebrew Path
if [[ $(uname -m) == "arm64" ]]; then
    BREW_PREFIX="/opt/homebrew"
else
    BREW_PREFIX="/usr/local"
fi
BREW_BIN="$BREW_PREFIX/bin/brew"

SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"
CURRENT_USER_ZPROFILE="$HOME/.zprofile"

# 4. Install Homebrew
if [ ! -f "$BREW_BIN" ]; then
    echo "🍺 Installing Homebrew..."
    # Download installer to temp file to avoid AppleScript quoting nightmares
    run_root "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o /tmp/install_brew.sh"
    run_root "chmod +x /tmp/install_brew.sh"
    run_admin "NONINTERACTIVE=1 /tmp/install_brew.sh"
    
    # Add to current user's path so it persists on future logins
    echo "" >> "$CURRENT_USER_ZPROFILE"
    echo "eval \"\$($BREW_BIN shellenv)\"" >> "$CURRENT_USER_ZPROFILE"
    echo "✅ Added Homebrew to $CURRENT_USER_ZPROFILE"
fi

# Force inject Homebrew into the CURRENT script's path so npm can be found
export PATH="$BREW_PREFIX/bin:$PATH"

# 5. Install Node.js & Caddy
if ! command -v node &> /dev/null || ! command -v caddy &> /dev/null; then
    echo "🟢 Installing Node.js & Caddy via Homebrew..."
    run_admin "$BREW_BIN install node caddy"
fi

NODE_PATH=$(which node)

# 6. Local Setup & Build (Runs normally as 'media')
echo "📁 Syncing files to Application Support..."
mkdir -p "$INSTALL_DIR"
rsync -av --exclude "node_modules" --exclude ".git" ./ "$INSTALL_DIR/"

echo "📦 Installing npm dependencies & building..."
cd "$INSTALL_DIR"
npm install
npm run build

echo "🎨 Copying assets for standalone mode..."
cp -r "$INSTALL_DIR/public" "$INSTALL_DIR/.next/standalone/public"
mkdir -p "$INSTALL_DIR/.next/standalone/.next"
cp -r "$INSTALL_DIR/.next/static" "$INSTALL_DIR/.next/standalone/.next/static"

# 7. Configure Caddy (Requires Root)
echo "⚙️  Configuring Caddy..."
# Write to temp file first, then move it as root
cat <<EOF > /tmp/Caddyfile_espace
:80, :443 {
    tls internal
    reverse_proxy localhost:3000
}
EOF
run_root "mv /tmp/Caddyfile_espace $BREW_PREFIX/etc/Caddyfile"

echo "🚀 Restarting Caddy background proxy..."
run_root "$BREW_BIN services restart caddy"

# 8. Create the LaunchAgent (Runs normally as 'media')
echo "⚙️  Creating Next.js background service..."
cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_NAME</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$BREW_PREFIX/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>PORT</key>
        <string>3000</string>
        <key>HOSTNAME</key>
        <string>0.0.0.0</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR/.next/standalone</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/tmp/espace_kiosk.err</string>
    <key>StandardOutPath</key>
    <string>/tmp/espace_kiosk.out</string>
</dict>
</plist>
EOF

# 9. Load Service
echo "🚀 Starting the Kiosk server..."
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "------------------------------------------"
echo "✅ Installed successfully!"
echo "Server: http://localhost:3000"
echo "Proxy:  http://localhost and https://localhost"
echo "------------------------------------------"
read -p "Press Enter to close..."