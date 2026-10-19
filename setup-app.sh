#!/bin/bash
# One-time setup: creates the Expo project and drops the FitFlow code into it.
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
APP="fitflow-app"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is missing. Install it with:  brew install node"
  exit 1
fi

if [ ! -d "$APP" ]; then
  echo "Creating the Expo project…"
  npx --yes create-expo-app@latest "$APP" --template default --yes
fi

cd "$APP"
echo "Adding the FitFlow screens…"
# Remove the starter template's example screens, keep its config and assets.
rm -rf app src components constants hooks scripts
cp -R "$ROOT/mobile/src" ./src

echo "Installing packages…"
npx expo install expo-router expo-notifications expo-clipboard expo-image-picker expo-constants \
  expo-status-bar react-native-svg react-native-safe-area-context \
  @react-native-community/datetimepicker @react-native-async-storage/async-storage \
  @react-navigation/native
npm install zustand

node "$ROOT/mobile/configure.js"

echo ""
echo "All set. To run the app:"
echo "  cd $APP && npx expo start"
echo "Then scan the QR code with your iPhone camera (install Expo Go from the App Store first)."
