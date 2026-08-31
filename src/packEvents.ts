export function packEvents(events: any[], filters: any) {
  const outEvents = JSON.parse(JSON.stringify(events || []));

  function pickNames(list: any): string[] {
    if (!list) return [];
    if (Array.isArray(list)) {
      return list.map((item) => {
        const name = item && (item.name ?? item.displayName ?? item.title ?? item.label) ? (item.name ?? item.displayName ?? item.title ?? item.label) : String(item);
        return String(name);
      });
    }
    if (typeof list === 'object') {
      return Object.keys(list).map((k) => {
        const v = list[k];
        const name = v && (v.name ?? v.displayName ?? v.title ?? v.label) ? (v.name ?? v.displayName ?? v.title ?? v.label) : String(v);
        return String(name);
      });
    }
    return [];
  }
  function extractNamesFromEvent(val: any): string[] {
    if (!val && val !== 0) return [];
    if (Array.isArray(val)) {
      return val.flatMap((v) => extractNamesFromEvent(v));
    }
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return [String(val)];
    }
    if (typeof val === 'object') {
      const name = val && (val.name ?? val.displayName ?? val.title ?? val.label ?? val.value ?? val.id);
      if (name) return [String(name)];
      return Object.keys(val).flatMap((k) => extractNamesFromEvent((val as any)[k]));
    }
    return [];
  }

  function countForKeys(keys: string[][]) {
    const freq = new Map<string, number>();
    if (!Array.isArray(outEvents)) return [] as { name: string; count: number }[];
    for (const ev of outEvents) {
      for (const keySet of keys) {
        for (const key of keySet) {
          if (ev && Object.prototype.hasOwnProperty.call(ev, key)) {
            const names = extractNamesFromEvent((ev as any)[key]);
            for (const n of names) freq.set(n, (freq.get(n) || 0) + 1);
            break;
          }
        }
      }
    }
    return Array.from(freq.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }

  function getStockholmHour(dateStr: string | undefined | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: 'numeric', hour12: false }).formatToParts(d);
      const hourPart = parts.find((p) => p.type === 'hour');
      if (!hourPart) return null;
      const h = parseInt(hourPart.value, 10);
      return Number.isNaN(h) ? null : h;
    } catch (err) {
      return null;
    }
  }

  const numFree = Array.isArray(outEvents) ? outEvents.filter((e: any) => e && e.isFree === true).length : 0;

  const numForChildren = Array.isArray(outEvents) ? outEvents.filter((e: any) => e && e.isForChildren === true).length : 0;
  const numPaid = Array.isArray(outEvents) ? outEvents.filter((e: any) => e && e.isFree === false).length : 0;
  const numAdult = Array.isArray(outEvents) ? outEvents.filter((e: any) => e && e.isForChildren === false).length : 0;
  const numMorning = Array.isArray(outEvents)
    ? outEvents.filter((e: any) => {
        try {
          const h = getStockholmHour(e && e.startTime);
          return h !== null && h < 12;
        } catch (_) {
          return false;
        }
      }).length
    : 0;
  const numEvening = Array.isArray(outEvents)
    ? outEvents.filter((e: any) => {
        try {
          const h = getStockholmHour(e && e.startTime);
          return h !== null && h >= 12 && h <= 17;
        } catch (_) {
          return false;
        }
      }).length
    : 0;
  const numNight = Array.isArray(outEvents)
    ? outEvents.filter((e: any) => {
        try {
          const h = getStockholmHour(e && e.startTime);
          return h !== null && h >= 18;
        } catch (_) {
          return false;
        }
      }).length
    : 0;

  const categories = countForKeys([['categoryNames', 'categoryName', 'categories', 'category', 'categoryValues', 'categoryValue']]);
  const languages = countForKeys([['languageNames', 'languageName', 'languages', 'language']]);
  const locations = countForKeys([['locationNames', 'locationName', 'locations', 'location']]);
  const accessibilities = countForKeys([['accessibilityNames', 'accessibilityName', 'accessibilityOptions', 'accessibilities', 'accessibility']]);

  return {
    events: outEvents,
    categories,
    languages,
    locations,
    accessibilities,
    meta: {
      free: numFree,
      paid: numPaid,
      forChildren: numForChildren,
      forAdult: numAdult,
      morning: numMorning,
      evening: numEvening,
      night: numNight,
    },
  } as const;
}

export default packEvents;
