export function packEvents(events: any[], filters: any) {
  const outEvents = JSON.parse(JSON.stringify(events || []));
  const unusedPackedEventFields = ['aboutEnglish', 'aboutShort', 'aboutShortEnglish', 'city', 'created', 'locationId', 'parentEventId', 'postalCode', 'price', 'status', 'titleEnglish'];

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

  const categories = countForKeys([['categoryNames', 'categoryName', 'categories', 'category', 'categoryValues', 'categoryValue']]);
  const languages = countForKeys([['languageNames', 'languageName', 'languages', 'language']]);
  const locations = countForKeys([['locationNames', 'locationName', 'locations', 'location']]);
  const accessibilities = countForKeys([['accessibilityNames', 'accessibilityName', 'accessibilityOptions', 'accessibilities', 'accessibility']]);

  for (const event of outEvents) {
    for (const field of unusedPackedEventFields) delete event[field];
  }

  return {
    events: outEvents,
    categories,
    languages,
    locations,
    accessibilities,
  } as const;
}

export default packEvents;
