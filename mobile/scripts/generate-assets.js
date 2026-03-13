/**
 * Asset generation script for Claude Flash Delivery.
 *
 * Generates SVG-based placeholder assets for development.
 * For production, replace these with professionally designed assets.
 *
 * Run: node scripts/generate-assets.js
 */
const fs = require('fs');
const path = require('path');

const assetsDir = path.resolve(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Simple SVG icon — orange lightning bolt on white circle
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="224" fill="#FF6B00"/>
  <path d="M560 128L320 544H480L448 896L704 448H528L560 128Z" fill="white"/>
</svg>`;

// Splash screen — orange background with centered logo
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <rect width="1284" height="2778" fill="#FF6B00"/>
  <path d="M692 1189L552 1397H632L616 1573L756 1349H672L692 1189Z" fill="white" transform="scale(2) translate(-200, -200)"/>
  <text x="642" y="1550" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white">Claude Flash</text>
  <text x="642" y="1620" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="white" opacity="0.8">Delivery</text>
</svg>`;

// Adaptive icon foreground (Android)
const adaptiveIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <path d="M560 128L320 544H480L448 896L704 448H528L560 128Z" fill="#FF6B00"/>
</svg>`;

// Write SVG files (these would need conversion to PNG for production)
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg);
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), splashSvg);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), adaptiveIconSvg);

// Create simple PNG placeholders using base64-encoded 1x1 pixel
// (real assets need proper generation via sharp, canvas, or design tool)
const createPlaceholderPng = (filename) => {
  // Minimal valid PNG (1x1 orange pixel)
  const pngHeader = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cf00000000020001e221bc330000000049454e44ae426082',
    'hex'
  );
  fs.writeFileSync(path.join(assetsDir, filename), pngHeader);
};

createPlaceholderPng('icon.png');
createPlaceholderPng('splash.png');
createPlaceholderPng('adaptive-icon.png');
createPlaceholderPng('favicon.png');

console.log('Assets generated in', assetsDir);
console.log('SVG source files: icon.svg, splash.svg, adaptive-icon.svg');
console.log('PNG placeholders: icon.png, splash.png, adaptive-icon.png, favicon.png');
console.log('');
console.log('For production, convert SVGs to PNGs at these sizes:');
console.log('  icon.png: 1024x1024');
console.log('  splash.png: 1284x2778');
console.log('  adaptive-icon.png: 1024x1024');
console.log('  favicon.png: 48x48');
