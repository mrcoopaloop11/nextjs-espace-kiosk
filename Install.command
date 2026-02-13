#!/bin/bash
# Created by Cooper Santillan
# eSpace Digital Kiosk - Installer

cd "$(dirname "$0")"

echo "------------------------------------------"
echo "   eSpace Kiosk - Installer"
echo "------------------------------------------"

# 1. Define Paths
SERVICE_NAME="com.cooper.espacekiosk"
INSTALL_DIR="$HOME/Library/Application Support/eSpaceKiosk"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# 2. Check for Node.js Dependency
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js is not installed!"
    echo "Attempting to install Node.js via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew is not installed. Please install Node.js manually from https://nodejs.org/"
        read -p "Press Enter to exit..."
        exit 1
    fi
    brew install node
fi

NODE_PATH=$(which node)
NPM_PATH=$(which npm)

# 3. Setup Directory
echo "📁 Copying application files to Application Support..."
mkdir -p "$INSTALL_DIR"
# We use rsync to copy your code while ignoring the heavy/cached folders
rsync -av --exclude "node_modules" --exclude ".next" --exclude ".git" ./ "$INSTALL_DIR/"

# 4. Install Dependencies & Build
echo "📦 Installing npm dependencies..."
cd "$INSTALL_DIR"
"$NPM_PATH" install

echo "🏗️  Building the Next.js application (This may take a minute)..."
"$NPM_PATH" run build

# 5. Create the Plist
echo "⚙️  Creating background service..."
cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_NAME</string>
    <key>Project</key>
    <string>eSpace Digital Kiosk</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$INSTALL_DIR/node_modules/.bin/next</string>
        <string>start</string>
        <string>-p</string>
        <string>3000</string>
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
echo "✅ Installed successfully!"
echo "The kiosk is now running in the background on http://localhost:3000"
echo "It will automatically start whenever this Mac turns on/logs in."
echo "------------------------------------------"
read -p "Press Enter to close..."