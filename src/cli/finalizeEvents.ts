#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { finalizeEvents } from '../finalizeEvents';

function parseArgs() {
  const argv = process.argv.slice(2);
  let merged: string | undefined;
  let filters: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--merged' && argv[i + 1]) {
      merged = argv[i + 1];
      i++;
    } else if (a === '--filters' && argv[i + 1]) {
      filters = argv[i + 1];
      i++;
    } else if (a === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i++;
    }
  }
  return { merged, filters, out };
}

async function main() {
  const args = parseArgs();
  const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
  const mergedPath = args.merged ?? path.join(DATA_DIR, 'mergedEvents.json');
  const filtersPath = args.filters ?? path.join(DATA_DIR, 'filters.json');
  const outPath = args.out ?? path.join(DATA_DIR, 'finalizedEvents.json');

  if (!fs.existsSync(mergedPath)) {
    console.error('Missing merged events file:', mergedPath);
    process.exit(2);
  }
  if (!fs.existsSync(filtersPath)) {
    console.error('Missing filters file:', filtersPath);
    process.exit(2);
  }

  try {
    const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
    const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
    const finalized = finalizeEvents(merged, filters);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(finalized, null, 2), 'utf8');
    console.log('Wrote', outPath, ' —', finalized.length, 'items');
  } catch (err) {
    console.error('Failed to finalize events:', err && (err as any).stack ? (err as any).stack : String(err));
    process.exit(1);
  }
}

if (require.main === module) main();
