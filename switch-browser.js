const fs = require('fs');
const path = require('path');

const target = (process.argv[2] || '').toLowerCase();

if (target === 'chrome' || target === 'chromium') {
  fs.copyFileSync(path.join(__dirname, 'manifest.chrome.json'), path.join(__dirname, 'manifest.json'));
  console.log('✓ Switched manifest.json to Chrome/Chromium mode (sidePanel enabled).');
} else if (target === 'firefox' || target === 'gecko') {
  fs.copyFileSync(path.join(__dirname, 'manifest.firefox.json'), path.join(__dirname, 'manifest.json'));
  console.log('✓ Switched manifest.json to Firefox mode (zero warnings, native sidebar_action).');
} else {
  console.log('Usage: node switch-browser.js [chrome|firefox]');
}
