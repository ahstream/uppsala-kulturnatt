import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '..', 'data');

const PARENT_FIELDS = ['checked', 'organizer', 'webpage', 'about', 'categories', 'accessibilityOptions', 'languages', 'locationId', 'locationAlias', 'streetAddress', 'isCancelled', 'isForChildren', 'isFree', 'price', 'coordinates', 'url', 'webpage'];

export function mergeEvents(events: any[], subEvents: any[]) {
  // build lookup by parent event id (match event.id or event.value)
  const map = new Map<string, any>();
  for (const ev of events) {
    const key = ev && (ev.id ?? ev.value) ? (ev.id ?? ev.value) : undefined;
    if (key) map.set(String(key), ev);
  }
  // merge parent properties into each subEvent and mark types
  const mergedSubs = subEvents.map((se) => {
    const parentId = se.parentEventId || se.parent || null;
    const copy: any = { ...se, type: 'subEvent' };
    if (!parentId) return copy;
    const parent = map.get(String(parentId));
    if (!parent) return copy;

    for (const f of PARENT_FIELDS) {
      if (parent[f] !== undefined) copy[f] = parent[f];
    }
    return copy;
  });

  // ensure original events are present and marked with type 'event'
  const eventsOut = events.map((ev) => ({ ...(ev || {}), type: (ev && ev.type) || 'event' }));

  // return merged list: subEvents first, then events
  return [...mergedSubs, ...eventsOut];
}
