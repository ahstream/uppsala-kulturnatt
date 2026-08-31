#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { mergeEvents } from '../mergeEvents';

function parseArgs() {
  const argv = process.argv.slice(2);
  let eventsIn: string | undefined;
  let subsIn: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--events' && argv[i + 1]) {
      eventsIn = argv[i + 1];
      i++;
    } else if (a === '--subs' && argv[i + 1]) {
      subsIn = argv[i + 1];
      i++;
    } else if (a === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i++;
    }
  }
  return { eventsIn, subsIn, out };
}

async function main() {
  const args = parseArgs();
  const eventsPath = args.eventsIn ?? 'data/events.json';
  const subsPath = args.subsIn ?? 'data/subEvents.json';
  const outPath = args.out ?? 'data/mergedEvents.json';

  if (!fs.existsSync(eventsPath)) {
    console.error(`Events input not found: ${eventsPath}`);
    process.exit(2);
  }
  if (!fs.existsSync(subsPath)) {
    console.error(`SubEvents input not found: ${subsPath}`);
    process.exit(2);
  }

  try {
    const eventsRaw = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    const subsRaw = JSON.parse(fs.readFileSync(subsPath, 'utf8'));

    let events: any[] = [];
    if (Array.isArray(eventsRaw)) events = eventsRaw;
    else if (eventsRaw && Array.isArray(eventsRaw.events)) events = eventsRaw.events;
    else {
      console.error('Unexpected events JSON shape');
      process.exit(2);
    }

    let subs: any[] = [];
    if (Array.isArray(subsRaw)) subs = subsRaw;
    else if (subsRaw && Array.isArray(subsRaw.subEvents)) subs = subsRaw.subEvents;
    else subs = subsRaw;

    const merged = mergeEvents(events, subs);

    const dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
    console.log('Wrote', outPath, ' — merged', merged.length, 'items');
  } catch (err) {
    console.error('Failed to merge events:', err && (err as any).stack ? (err as any).stack : String(err));
    process.exit(1);
  }
}

if (require.main === module) main();
