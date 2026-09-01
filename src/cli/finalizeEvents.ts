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

function eventId(event: any) {
  return event && (event.id ?? event.externalId ?? event.value ?? event.eventId) ? String(event.id ?? event.externalId ?? event.value ?? event.eventId) : null;
}

function readHistoricEvents(historicPath: string) {
  const events = fs.existsSync(historicPath) ? JSON.parse(fs.readFileSync(historicPath, 'utf8')) : [];
  if (!Array.isArray(events)) throw new Error(`Expected ${historicPath} to contain a list of events`);

  const byId = new Map<string, { event: any; index: number }>();
  events.forEach((event, index) => {
    const id = eventId(event);
    if (id) byId.set(id, { event, index });
  });
  return { events, byId };
}

const HISTORIC_CHANGE_PROPERTIES = ['title', 'about', 'startTime', 'endTime', 'locationId'];

function historicChangedProperties(event: any, historicEvent: any) {
  return HISTORIC_CHANGE_PROPERTIES.filter((property) => event?.[property] !== historicEvent?.[property]);
}

function timestampValue(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareDefault(first: any, second: any) {
  const firstStart = Date.parse(first.startTime);
  const secondStart = Date.parse(second.startTime);
  const firstStartValue = Number.isNaN(firstStart) ? Number.POSITIVE_INFINITY : firstStart;
  const secondStartValue = Number.isNaN(secondStart) ? Number.POSITIVE_INFINITY : secondStart;
  if (firstStartValue !== secondStartValue) return firstStartValue - secondStartValue;

  const firstEnd = Date.parse(first.endTime);
  const secondEnd = Date.parse(second.endTime);
  const firstDuration = Number.isNaN(firstStart) || Number.isNaN(firstEnd) ? Number.POSITIVE_INFINITY : firstEnd - firstStart;
  const secondDuration = Number.isNaN(secondStart) || Number.isNaN(secondEnd) ? Number.POSITIVE_INFINITY : secondEnd - secondStart;
  if (firstDuration !== secondDuration) return firstDuration - secondDuration;

  return String(first.title ?? '').localeCompare(String(second.title ?? ''), 'sv');
}

function compareUpdated(first: any, second: any) {
  const updatedDiff = timestampValue(second.updated) - timestampValue(first.updated);
  return updatedDiff || compareDefault(first, second);
}

function assignSortKeys(events: any[]) {
  events.sort(compareDefault).forEach((event, index) => {
    event.sortKeyTime = index + 1;
  });

  events.sort(compareUpdated).forEach((event, index) => {
    event.sortKeyUpdated = index + 1;
  });

  events.sort(compareDefault);
}

async function main() {
  const args = parseArgs();
  const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
  const mergedPath = args.merged ?? path.join(DATA_DIR, 'mergedEvents.json');
  const filtersPath = args.filters ?? path.join(DATA_DIR, 'filters.json');
  const outPath = args.out ?? path.join(DATA_DIR, 'finalizedEvents.json');
  const historicPath = path.join(DATA_DIR, 'historic.json');

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
    const historic = readHistoricEvents(historicPath);
    for (const event of finalized) {
      const id = eventId(event);
      const historicMatch = id ? historic.byId.get(id) : undefined;

      if (!historicMatch) {
        event.created = event.checked;
        event.updated = event.checked;
        event.status = 'new';
        historic.events.push(event);
        if (id) historic.byId.set(id, { event, index: historic.events.length - 1 });
        continue;
      }

      const historicEvent = historicMatch.event;
      event.created = historicEvent.created;
      event.updated = historicEvent.updated;
      event.status = 'old';

      const changedProperties = historicChangedProperties(event, historicEvent);
      if (changedProperties.length > 0) {
        event.status = 'updated';
        event.updated = event.checked;
        console.log(
          'Updated event detected:',
          JSON.stringify(
            {
              id,
              changedProperties,
              currentEvent: event,
              historicEvent,
            },
            null,
            2,
          ),
        );
        historic.events[historicMatch.index] = event;
        if (id) historic.byId.set(id, { event, index: historicMatch.index });
      }
    }
    assignSortKeys(finalized);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(historicPath, JSON.stringify(historic.events, null, 2), 'utf8');
    console.log('Wrote', historicPath, ' —', historic.events.length, 'items');
    fs.writeFileSync(outPath, JSON.stringify(finalized, null, 2), 'utf8');
    console.log('Wrote', outPath, ' —', finalized.length, 'items');
  } catch (err) {
    console.error('Failed to finalize events:', err && (err as any).stack ? (err as any).stack : String(err));
    process.exit(1);
  }
}

if (require.main === module) main();
