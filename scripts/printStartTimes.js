const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '..', 'data', 'finalizedEvents.json');
if (!fs.existsSync(p)) {
  console.error('Missing file:', p);
  process.exit(2);
}
let data;
try {
  data = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (err) {
  console.error('Failed to parse JSON:', err && err.stack ? err.stack : String(err));
  process.exit(1);
}
const starts = [];
if (Array.isArray(data)) {
  for (const e of data) {
    if (e && e.startTime) starts.push(e.startTime);
  }
} else if (data && Array.isArray(data.events)) {
  for (const e of data.events) {
    if (e && e.startTime) starts.push(e.startTime);
  }
}
starts.sort((a, b) => new Date(a) - new Date(b));
for (const s of starts) console.log(s);
console.log('TOTAL_STARTS', starts.length);
