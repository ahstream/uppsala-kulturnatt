#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import packEvents from '../packEvents';

function parseArgs() {
  const argv = process.argv.slice(2);
  let events: string | undefined;
  let filters: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--events' && argv[i + 1]) {
      events = argv[i + 1];
      i++;
    } else if (a === '--filters' && argv[i + 1]) {
      filters = argv[i + 1];
      i++;
    } else if (a === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i++;
    }
  }
  return { events, filters, out };
}

async function main() {
  const args = parseArgs();
  const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
  const eventsPath = args.events ?? path.join(DATA_DIR, 'finalizedEvents.json');
  const filtersPath = args.filters ?? path.join(DATA_DIR, 'filters.json');
  const outPath = args.out ?? path.join(DATA_DIR, 'packedEvents.json');

  if (!fs.existsSync(eventsPath)) {
    console.error('Missing events file:', eventsPath);
    process.exit(2);
  }
  if (!fs.existsSync(filtersPath)) {
    console.error('Missing filters file:', filtersPath);
    process.exit(2);
  }

  try {
    const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
    const packed = packEvents(events, filters);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(packed, null, 2), 'utf8');
    console.log('Wrote', outPath);
  } catch (err) {
    console.error('Failed to create packed data:', err && (err as any).stack ? (err as any).stack : String(err));
    process.exit(1);
  }
}

if (require.main === module) main();
