#!/usr/bin/env bash
# EdgeLog — Capacitor native project setup
# Run once after cloning to scaffold the iOS and Android projects.
#
# Prerequisites:
#   iOS:     macOS + Xcode 15+ + CocoaPods (`sudo gem install cocoapods`)
#   Android: Android Studio + JDK 17+ + ANDROID_HOME set in shell
#
# Usage:
#   ./scripts/setup-native.sh           # both platforms
#   ./scripts/setup-native.sh ios       # iOS only
#   ./scripts/setup-native.sh android   # Android only

set -euo pipefail

PLATFORM="${1:-both}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ EdgeLog native setup (platform: $PLATFORM)"
cd "$ROOT"

# 1. Ensure Capacitor CLI is available
if ! npx cap --version &>/dev/null; then
  echo "✗ @capacitor/cli not found — run: npm install" && exit 1
fi

echo "✓ Capacitor $(npx cap --version)"

# 2. Add platforms
add_ios() {
  if [ -d ios ]; then
    echo "  ios/ already exists — skipping add, running sync"
  else
    echo "→ Adding iOS platform…"
    npx cap add ios
  fi
  echo "→ Syncing iOS…"
  npx cap sync ios
  echo "✓ iOS ready — open with: npx cap open ios"
}

add_android() {
  if [ -d android ]; then
    echo "  android/ already exists — skipping add, running sync"
  else
    echo "→ Adding Android platform…"
    npx cap add android
  fi
  echo "→ Syncing Android…"
  npx cap sync android
  echo "✓ Android ready — open with: npx cap open android"
}

case "$PLATFORM" in
  ios)     add_ios ;;
  android) add_android ;;
  both)    add_ios; add_android ;;
  *)       echo "Usage: $0 [ios|android|both]" && exit 1 ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════"
echo " Next steps"
echo "═══════════════════════════════════════════════════════"
echo ""
echo " 1. Set CAPACITOR_APP_URL in .env to your production URL"
echo "    (or use http://10.0.2.2:3000 for Android emulator)"
echo ""
echo " 2. iOS — open Xcode and:"
echo "    • Set Bundle ID to: app.edgelog.journal"
echo "    • Enable Push Notifications capability"
echo "    • Enable Background Modes → Remote notifications"
echo "    • Set minimum deployment target: iOS 14.0"
echo "    npx cap open ios"
echo ""
echo " 3. Android — open Android Studio and:"
echo "    • Add google-services.json to android/app/"
echo "    • Set applicationId to: app.edgelog.journal"
echo "    npx cap open android"
echo ""
echo " 4. Set FIREBASE_SERVER_KEY in .env for native push"
echo "    Firebase Console → Project Settings → Cloud Messaging"
echo ""
echo " 5. During development, run Next.js dev server then:"
echo "    npx cap run ios     (or android)"
echo ""
