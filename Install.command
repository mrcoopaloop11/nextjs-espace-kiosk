#!/bin/bash
# Created by Cooper Santillan
# eSpace Digital Kiosk - Installer (Fixed for Standalone & Caddy)

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Installer"
echo "------------------------------------------"

# 1. Define Paths
SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# 2. Check for Node.js & Homebrew
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js is not installed! Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Install it from https://brew.sh/"
        exit 1
    fi
    brew install node
fi

NODE_PATH=$(which node)

# 3. Setup Directory & Build
echo "📁 Syncing files..."
mkdir -p "$INSTALL_DIR"
rsync -av --exclude "node_modules" --exclude ".git" ./ "$INSTALL_DIR/"

echo "📦 Installing dependencies & building..."
cd "$INSTALL_DIR"
npm install
npm run build

echo "🎨 Copying assets for standalone mode..."
cp -r "$INSTALL_DIR/public" "$INSTALL_DIR/.next/standalone/public"
mkdir -p "$INSTALL_DIR/.next/standalone/.next"
cp -r "$INSTALL_DIR/.next/static" "$INSTALL_DIR/.next/standalone/.next/static"

# 4. Handle Caddy (Reverse Proxy)
if ! command -v caddy &> /dev/null; then
    brew install caddy
fi

# Detect Homebrew prefix (Intel vs Apple Silicon)
BREW_PREFIX=$(brew --prefix)
CADDY_CONFIG="$BREW_PREFIX/etc/Caddyfile"

echo "⚙️  Configuring Caddy for Local HTTPS..."
sudo bash -c "cat <<EOF > $CADDY_CONFIG
# This listens on both 80 and 443
:80, :443 {
    # Generates a local self-signed cert
    tls internal
    reverse_proxy localhost:3000
}
EOF"

# Restart Caddy to apply
sudo brew services restart caddy

# 5. Create the Plist (FIXED FOR STANDALONE MODE)
echo "⚙️  Creating background service..."

# We target .next/standalone/server.js directly as per your error log
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

# 6. Load Service
echo "🚀 Starting the Kiosk server..."
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "------------------------------------------"
echo "✅ Done!"
echo "Next.js running on: http://localhost:3000"
echo "Proxy running on:   http://localhost"
echo "------------------------------------------"
read -p "Press Enter to close..."
exit 0