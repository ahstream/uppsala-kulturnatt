#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { getSubEvents } from '../getSubEvents';

function parseArgs(): { in?: string; out?: string; id?: string } {
  const argv = process.argv.slice(2);
  let inf: string | undefined;
  let out: string | undefined;
  let id: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in' && argv[i + 1]) {
      inf = argv[i + 1];
      i++;
    } else if (a === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i++;
    } else if (a === '--id' && argv[i + 1]) {
      id = argv[i + 1];
      i++;
    }
  }
  return { in: inf, out, id };
}

async function main() {
  const args = parseArgs();
  const inPath = args.in ?? 'data/events.json';
  const outPath = args.out ?? 'data/subEvents.json';

  if (!fs.existsSync(inPath)) {
    console.error(`Input file not found: ${inPath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(inPath, { encoding: 'utf-8' });
  let eventsRaw: any;
  try {
    eventsRaw = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse input JSON:', e);
    process.exit(2);
    return;
  }

  let events: any[] = [];
  if (Array.isArray(eventsRaw)) events = eventsRaw;
  else if (eventsRaw && Array.isArray(eventsRaw.events)) events = eventsRaw.events;
  else {
    console.error('Unexpected JSON shape: expected array of events or object with `events` array');
    process.exit(2);
    return;
  }

  const outSubs: { type: string; id: string; parentEventId: string | null; parentTitle: string; title: string; startTimeText: string; endTimeText?: string | null; startTime?: string; endTime?: string | null }[] = [];
  const nonSubs: any[] = [];
  let totalFound = 0;

  if (args.id) {
    const ev = events.find((e: any) => e.id === args.id || e.value === args.id);
    if (!ev) {
      console.error(`Event with id/value '${args.id}' not found`);
      process.exit(2);
      return;
    }
    const subs = getSubEvents(ev);
    if (!subs || subs.length === 0) {
      nonSubs.push({ type: 'event', title: ev.title ?? '', about: ev.about ?? '' });
    }
    for (const s of subs) {
      outSubs.push({ type: 'subEvent', id: s.id, parentEventId: ev.id ?? ev.value ?? null, parentTitle: ev.title ?? '', title: s.title, startTimeText: s.startTimeText, endTimeText: s.endTimeText ?? null, startTime: s.startTime ?? undefined, endTime: s.endTime ?? null });
      totalFound++;
    }
  } else {
    for (const ev of events) {
      const subs = getSubEvents(ev);
      if (!subs || subs.length === 0) {
        nonSubs.push({ type: 'event', title: ev.title ?? '', about: ev.about ?? '' });
      }
      for (const s of subs) {
        outSubs.push({ type: 'subEvent', id: s.id, parentEventId: ev.id ?? ev.value ?? null, parentTitle: ev.title ?? '', title: s.title, startTimeText: s.startTimeText, endTimeText: s.endTimeText ?? null, startTime: s.startTime ?? undefined, endTime: s.endTime ?? null });
        totalFound++;
      }
    }
  }

  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(outSubs, null, 2), { encoding: 'utf-8' });

  const nonOutPath = path.join(dir, 'eventsWithoutSubEvent.json');
  fs.writeFileSync(nonOutPath, JSON.stringify(nonSubs, null, 2), { encoding: 'utf-8' });

  console.log(`Wrote ${outPath} — extracted ${totalFound} subevents`);
  console.log(`Wrote ${nonOutPath} — ${nonSubs.length} events without subevents`);
}

if (require.main === module) main();
