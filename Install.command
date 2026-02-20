#!/bin/bash
# Created by Cooper Santillan
# eSpace Digital Kiosk - Full Auto-Installer

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Installer"
echo "------------------------------------------"

# 1. Define Paths
SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# 2. Check/Install Homebrew
if ! command -v brew &> /dev/null; then
    echo "🍺 Homebrew not found. Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add brew to path for the current session (Handling both Apple Silicon & Intel)
    if [[ $(uname -m) == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

# 3. Check/Install Node.js
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js..."
    brew install node
fi

NODE_PATH=$(which node)
BREW_PREFIX=$(brew --prefix)

# 4. Setup Directory & Build
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

# 5. Handle Caddy (Reverse Proxy)
if ! command -v caddy &> /dev/null; then
    echo "🔒 Installing Caddy..."
    brew install caddy
fi

CADDY_CONFIG="$BREW_PREFIX/etc/Caddyfile"

echo "⚙️  Configuring Caddy for Network & Local HTTPS..."
sudo bash -c "cat <<EOF > $CADDY_CONFIG
# Listen on 80 and 443 for any IP or hostname
:80, :443 {
    tls internal
    reverse_proxy localhost:3000
}
EOF"

echo "🚀 Restarting Caddy (requires sudo)..."
sudo brew services restart caddy

# 6. Create the Plist
echo "⚙️  Creating background service..."
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

# 7. Load Service
echo "🚀 Starting the Kiosk server..."
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "------------------------------------------"
echo "✅ Done!"
echo "Server: http://localhost:3000"
echo "Proxy:  http://localhost and https://localhost"
echo "------------------------------------------"
read -p "Press Enter to close..."