const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT_DIR, 'src', 'site');
const SOURCE_DATA_PATH = path.join(ROOT_DIR, 'data', 'packedEvents.json');
const TARGET_DATA_DIR = path.join(SITE_DIR, 'data');
const TARGET_DATA_PATH = path.join(TARGET_DATA_DIR, 'packedEvents.json');
const HEADERS_PATH = path.join(SITE_DIR, '_headers');

if (!fs.existsSync(SOURCE_DATA_PATH)) {
  console.error('Missing packed events file:', SOURCE_DATA_PATH);
  process.exit(2);
}

fs.mkdirSync(TARGET_DATA_DIR, { recursive: true });
fs.copyFileSync(SOURCE_DATA_PATH, TARGET_DATA_PATH);

fs.writeFileSync(HEADERS_PATH, ['/*', '  Cross-Origin-Opener-Policy: same-origin-allow-popups', '', '/', '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0', '  CDN-Cache-Control: no-store', '', '/index.html', '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0', '  CDN-Cache-Control: no-store', '', '/app.js', '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0', '  CDN-Cache-Control: no-store', '', '/style.css', '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0', '  CDN-Cache-Control: no-store', '', '/data/packedEvents.json', '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0', '  CDN-Cache-Control: no-store', ''].join('\n'), 'utf8');

console.log('Copied', path.relative(ROOT_DIR, SOURCE_DATA_PATH), 'to', path.relative(ROOT_DIR, TARGET_DATA_PATH));
console.log('Wrote', path.relative(ROOT_DIR, HEADERS_PATH));
