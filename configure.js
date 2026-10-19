// Applies FitFlow's settings to the app.json that create-expo-app generated.
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app.json');
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const expo = json.expo || (json.expo = {});

expo.name = 'FitFlow';
expo.scheme = 'fitflow'; // lets fitflow://import?url=... open the import screen
expo.userInterfaceStyle = 'dark';
expo.backgroundColor = '#0A0A0B';
expo.ios = {
  ...(expo.ios || {}),
  infoPlist: {
    ...((expo.ios || {}).infoPlist || {}),
    NSPhotoLibraryUsageDescription: 'Choose a photo for your recipe.',
  },
};

const plugins = expo.plugins || [];
const has = (name) => plugins.some((p) => (Array.isArray(p) ? p[0] : p) === name);
for (const p of ['expo-router', 'expo-notifications']) if (!has(p)) plugins.push(p);
if (!has('expo-image-picker')) {
  plugins.push(['expo-image-picker', { photosPermission: 'Choose a photo for your recipe.' }]);
}
// Dark splash screen to match the app.
for (const p of plugins) {
  if (Array.isArray(p) && p[0] === 'expo-splash-screen') {
    p[1] = { ...(p[1] || {}), backgroundColor: '#0A0A0B' };
    if (p[1].dark) p[1].dark.backgroundColor = '#0A0A0B';
  }
}
expo.plugins = plugins;

fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
console.log('app.json updated for FitFlow');
