export function finalizeEvents(events: any[], filters: any) {
  const cats = filters && (filters.categories || filters.category) ? filters.categories || filters.category : [];

  const map = new Map<string, string>();

  if (Array.isArray(cats)) {
    for (const c of cats) {
      try {
        const key = c && (c.key ?? c.id ?? c.value ?? c.code ?? c.slug) ? String(c.key ?? c.id ?? c.value ?? c.code ?? c.slug) : undefined;
        const name = c && (c.name ?? c.displayName ?? c.title ?? c.label) ? (c.name ?? c.displayName ?? c.title ?? c.label) : typeof c === 'string' ? c : undefined;
        if (key) map.set(key, name ?? key);
      } catch (e) {
        // ignore
      }
    }
  } else if (cats && typeof cats === 'object') {
    for (const k of Object.keys(cats)) {
      const v = cats[k];
      const name = v && (v.name ?? v.displayName ?? v.title ?? v.label) ? (v.name ?? v.displayName ?? v.title ?? v.label) : String(v);
      map.set(String(k), name);
    }
  }

  // build language map from filters
  const langMap = new Map<string, string>();
  const langs = filters && (filters.languages || filters.language) ? filters.languages || filters.language : [];
  if (Array.isArray(langs)) {
    for (const l of langs) {
      try {
        const key = l && (l.key ?? l.id ?? l.value ?? l.code ?? l.slug) ? String(l.key ?? l.id ?? l.value ?? l.code ?? l.slug) : undefined;
        const name = l && (l.name ?? l.displayName ?? l.title ?? l.label) ? (l.name ?? l.displayName ?? l.title ?? l.label) : typeof l === 'string' ? l : undefined;
        if (key) langMap.set(key, name ?? key);
      } catch (e) {
        // ignore
      }
    }
  } else if (langs && typeof langs === 'object') {
    for (const k of Object.keys(langs)) {
      const v = langs[k];
      const name = v && (v.name ?? v.displayName ?? v.title ?? v.label) ? (v.name ?? v.displayName ?? v.title ?? v.label) : String(v);
      langMap.set(String(k), name);
    }
  }

  // build location map from filters
  const locationMap = new Map<string, string>();
  const locs = filters && (filters.locations || filters.location) ? filters.locations || filters.location : [];
  if (Array.isArray(locs)) {
    for (const l of locs) {
      try {
        const key = l && (l.key ?? l.id ?? l.value ?? l.code ?? l.slug) ? String(l.key ?? l.id ?? l.value ?? l.code ?? l.slug) : undefined;
        const name = l && (l.name ?? l.displayName ?? l.title ?? l.label) ? (l.name ?? l.displayName ?? l.title ?? l.label) : typeof l === 'string' ? l : undefined;
        if (key) locationMap.set(key, name ?? key);
      } catch (e) {
        // ignore
      }
    }
  } else if (locs && typeof locs === 'object') {
    for (const k of Object.keys(locs)) {
      const v = locs[k];
      const name = v && (v.name ?? v.displayName ?? v.title ?? v.label) ? (v.name ?? v.displayName ?? v.title ?? v.label) : String(v);
      locationMap.set(String(k), name);
    }
  }

  // build accessibility map from filters
  const accessibilityMap = new Map<string, string>();
  const accs = filters && (filters.accessibilities || filters.accessibility) ? filters.accessibilities || filters.accessibility : [];
  if (Array.isArray(accs)) {
    for (const a of accs) {
      try {
        const key = a && (a.key ?? a.id ?? a.value ?? a.code ?? a.slug) ? String(a.key ?? a.id ?? a.value ?? a.code ?? a.slug) : undefined;
        const name = a && (a.name ?? a.displayName ?? a.title ?? a.label) ? (a.name ?? a.displayName ?? a.title ?? a.label) : typeof a === 'string' ? a : undefined;
        if (key) accessibilityMap.set(key, name ?? key);
      } catch (e) {
        // ignore
      }
    }
  } else if (accs && typeof accs === 'object') {
    for (const k of Object.keys(accs)) {
      const v = accs[k];
      const name = v && (v.name ?? v.displayName ?? v.title ?? v.label) ? (v.name ?? v.displayName ?? v.title ?? v.label) : String(v);
      accessibilityMap.set(String(k), name);
    }
  }

  const out = events.map((ev) => {
    const copy: any = { ...(ev || {}) };
    if (typeof copy.about === 'string') copy.about = copy.about.trim();
    if (typeof copy.title === 'string') copy.title = copy.title.replace(/^:+/, '').trim();
    let evCats: any[] = [];
    if (Array.isArray(copy.categories)) evCats = copy.categories;
    else if (Array.isArray(copy.category)) evCats = copy.category;
    else if (copy.categories && typeof copy.categories === 'string') evCats = [copy.categories];

    const values: string[] = [];
    for (const c of evCats) {
      let k: string | undefined;
      if (typeof c === 'string' || typeof c === 'number') k = String(c);
      else if (c && typeof c === 'object') k = String(c.key ?? c.id ?? c.value ?? c.code ?? c.slug);
      if (!k) continue;
      const name = map.has(k) ? (map.get(k) as string) : c && typeof c === 'object' && (c.name ?? c.title) ? (c.name ?? c.title) : k;
      if (name && !values.includes(name)) values.push(name);
    }

    copy.categoryNames = values;

    // languages -> languageNames
    let evLangs: any[] = [];
    if (Array.isArray(copy.languages)) evLangs = copy.languages;
    else if (Array.isArray(copy.language)) evLangs = copy.language as any[];
    else if (copy.languages && typeof copy.languages === 'string') evLangs = [copy.languages];

    const langValues: string[] = [];
    for (const l of evLangs) {
      let k: string | undefined;
      if (typeof l === 'string' || typeof l === 'number') k = String(l);
      else if (l && typeof l === 'object') k = String(l.key ?? l.id ?? l.value ?? l.code ?? l.slug);
      if (!k) continue;
      const name = langMap.has(k) ? (langMap.get(k) as string) : l && typeof l === 'object' && (l.name ?? l.title) ? (l.name ?? l.title) : k;
      if (name && !langValues.includes(name)) langValues.push(name);
    }

    copy.languageNames = langValues;

    // locations -> locationNames
    let evLocs: any[] = [];
    if (Array.isArray(copy.locations)) evLocs = copy.locations;
    else if (Array.isArray(copy.location)) evLocs = copy.location as any[];
    else if (copy.locationId) evLocs = [copy.locationId];
    else if (copy.location && typeof copy.location === 'string') evLocs = [copy.location];

    const locValues: string[] = [];
    for (const l of evLocs) {
      let k: string | undefined;
      if (typeof l === 'string' || typeof l === 'number') k = String(l);
      else if (l && typeof l === 'object') k = String(l.key ?? l.id ?? l.value ?? l.code ?? l.slug);
      if (!k) continue;
      const name = locationMap.has(k) ? (locationMap.get(k) as string) : l && typeof l === 'object' && (l.name ?? l.title) ? (l.name ?? l.title) : k;
      if (name && !locValues.includes(name)) locValues.push(name);
    }

    copy.locationNames = locValues;

    // accessibility options -> accessibilityNames
    let evAccs: any[] = [];
    if (Array.isArray(copy.accessibilityOptions)) evAccs = copy.accessibilityOptions;
    else if (Array.isArray(copy.accessibilities)) evAccs = copy.accessibilities as any[];
    else if (Array.isArray(copy.accessibility)) evAccs = copy.accessibility as any[];
    else if (copy.accessibilityOptions && typeof copy.accessibilityOptions === 'string') evAccs = [copy.accessibilityOptions];

    const accValues: string[] = [];
    for (const a of evAccs) {
      let k: string | undefined;
      if (typeof a === 'string' || typeof a === 'number') k = String(a);
      else if (a && typeof a === 'object') k = String(a.key ?? a.id ?? a.value ?? a.code ?? a.slug);
      if (!k) continue;
      const name = accessibilityMap.has(k) ? (accessibilityMap.get(k) as string) : a && typeof a === 'object' && (a.name ?? a.title) ? (a.name ?? a.title) : k;
      if (name && !accValues.includes(name)) accValues.push(name);
    }

    copy.accessibilityNames = accValues;

    // remove raw fields no longer needed in finalized output
    try {
      delete copy.categories;
      delete copy.category;
      delete copy.locations;
      delete copy.location;
      delete copy.languages;
      delete copy.language;
      delete copy.accessibilityOptions;
      delete copy.accessibilities;
      delete copy.accessibility;
    } catch (e) {
      // ignore
    }

    return copy;
  });

  return out.sort((first, second) => {
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
  });
}
