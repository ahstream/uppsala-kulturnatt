import { GLOBAL_START_DATE } from './globals';

export interface SubEvent {
  id: string;
  title: string;
  startTimeText: string;
  endTimeText?: string | null;
  // computed ISO timestamp (UTC) derived from global start and the text
  startTime?: string;
  endTime?: string | null;
  raw?: string;
}

function tryParseTimeLine(line: string) {
  const trimmed = line.trim();
  // If the line references a calendar date (month names), it's prose not a schedule
  const monthRe = /\b(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|maj|jun|jul|aug|sep|sept|okt|nov|dec)\b/i;
  if (monthRe.test(trimmed)) return null;
  // Accept times like '19:00', '19.00', '19: 00' or '19 . 00' and ranges '19:00-20:00' or '19.00–20.00' (accept unicode dashes)
  // Ensure the time token is not directly followed by another digit (avoids matching '1979' as '19')
  const reRange = /^((?:\d{1,2}(?:(?:[:.])\s*\d{2})?))(?!\d)\s*(?:-|\u2013|\u2014)\s*((?:\d{1,2}(?:(?:[:.])\s*\d{2})?))(?!\d)\s*(?:\{([^}]+)\}|(.+))?$/;
  const reSingle = /^((?:\d{1,2}(?:(?:[:.])\s*\d{2})?))(?!\d)\s*(?:\{([^}]+)\}|(.+))?$/;

  let m = trimmed.match(reRange);
  if (m) {
    // preserve original formatting (e.g., '10.00') for start/end text
    const start = m[1];
    const end = m[2];
    const title = (m[3] || m[4] || '').trim();
    return { start, end, title, raw: line };
  }
  m = trimmed.match(reSingle);
  if (m) {
    const start = m[1];
    const end = undefined;
    const title = (m[2] || m[3] || '').trim();
    return { start, end, title, raw: line };
  }
  return null;
}

export function getSubEvents(ev: any): SubEvent[] {
  const about = ev && typeof ev.about === 'string' ? ev.about : undefined;
  if (!about) return [];

  // preserve blank lines so we can use them to separate paragraphs
  const lines = about.split(/\r?\n/).map((l: string) => l.trim());

  const subs: SubEvent[] = [];
  // compute timezone offset for Europe/Stockholm at the festival date
  let tzOffsetMs = 0;
  try {
    const parts = GLOBAL_START_DATE.split('-').map((s) => parseInt(s, 10));
    if (parts.length === 3) {
      const [y, m, d] = parts;
      // pick noon UTC on that date to avoid DST edge-case moments
      const ts = Date.UTC(y, m - 1, d, 12, 0, 0);
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const partsFormatted = dtf.formatToParts(new Date(ts));
      const get = (t: string) => Number((partsFormatted.find((p) => p.type === t) || { value: '0' }).value);
      const constructed = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
      tzOffsetMs = constructed - ts; // positive if local = UTC + offset
    }
  } catch (e) {
    tzOffsetMs = 0;
  }
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i];
    // remove all '*' characters before attempting to parse times
    const cleanedLn = ln.replace(/\*/g, '');
    let parsed = tryParseTimeLine(cleanedLn);

    if (parsed) {
      // join following lines that are clearly continuations (do not start with a time)
      const timeStartRe = /^\s*\d{1,2}(?:(?:[:.])\d{2})?(?:\s*(?:-|\u2013|\u2014)\s*\d{1,2}(?:(?:[:.])\d{2})?)?/;
      while (i + 1 < lines.length) {
        const nextRaw = lines[i + 1];
        const nextClean = nextRaw.replace(/\*/g, '');
        // stop joining if we hit a blank line (explicit paragraph break)
        if (!nextClean || nextClean.trim() === '') break;
        if (timeStartRe.test(nextClean)) break;

        // Heuristic: treat as continuation only when the next line starts with
        // a lowercase letter, punctuation/parenthesis/quote, or a digit.
        const fc = nextClean.charAt(0);
        const isLetter = fc.toLowerCase() !== fc.toUpperCase();
        let isContinuation = false;
        if (isLetter) {
          // join only if lowercase
          isContinuation = fc === fc.toLowerCase();
        } else {
          // non-letter: accept if starts with punctuation, quote, parenthesis, dash, or digit
          isContinuation = /[\(\["'«“\-–—\d]/.test(fc);
        }

        if (!isContinuation) break;

        // treat as continuation
        parsed.title = (parsed.title + ' ' + nextClean).trim();
        parsed.raw = (parsed.raw || '') + '\n' + nextClean;
        i++;
      }

      console.warn('Parsed line:', { line: ln, cleaned: cleanedLn, parsed });

      const idx = subs.length + 1;
      const sid = (ev && (ev.id || ev.value) ? ev.id || ev.value : 'event') + `-sub-${idx}`;
      const rawTitle = parsed.title || ev.title || '';
      let title = rawTitle.replace(/^,\s*/, '').replace(/- /g, '').trim();
      if (title.length > 0) title = title.charAt(0).toUpperCase() + title.slice(1);
      const startText = parsed.start;
      const endText = parsed.end ?? null;
      const sub: SubEvent = { id: sid, title, startTimeText: startText, endTimeText: endText, raw: parsed.raw };

      // compute ISO UTC startTime based on global start date
      try {
        const base = new Date(`${GLOBAL_START_DATE}T00:00:00Z`); // UTC midnight of festival
        if (isNaN(base.getTime())) {
          console.error('Invalid global start date (GLOBAL_START_DATE) - debug:', {
            GLOBAL_START_DATE,
            eventId: ev && (ev.id || ev.value) ? ev.id || ev.value : undefined,
            eventTitle: ev && ev.title ? ev.title : undefined,
            line: ln,
            parsed,
            startText,
            endText,
          });
          // stop processing to surface the invalid global start
          try {
            setTimeout(() => process.exit(1), 0);
          } catch (e) {
            throw new Error('Invalid global start time and cannot exit process');
          }
        }

        // Helper to parse HH:MM or HH formats
        const parseHM = (t: string | null) => {
          console.warn('Parsing time text:', { t });
          if (!t || typeof t !== 'string') return null;
          // accept 'HH:MM' or 'HH.MM' or 'HH', and allow spaces after the separator like 'HH: MM'
          const m = t.trim().match(/^(\d{1,2})(?:(?:[:.])\s*(\d{2}))?$/);
          console.warn('Parsed time match:', { m });
          if (!m) return null;
          const hh = parseInt(m[1], 10);
          const mm = m[2] ? parseInt(m[2], 10) : 0;
          console.warn('Parsed time components:', { hh, mm });
          if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
          if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
          return { hh, mm };
        };

        const s = parseHM(startText);
        if (s) {
          console.warn('Parsed start time components:', { s });
          // ensure numeric components
          const sh = Number(s.hh);
          const sm = Number(s.mm);
          if (!Number.isFinite(sh) || !Number.isFinite(sm)) {
            throw new Error(`Invalid parsed time components: ${JSON.stringify(s)}`);
          }
          // Construct the UTC timestamp corresponding to the local Sweden wall-clock
          const constructedUTC = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), sh, sm, 0);
          const realUtcTs = constructedUTC - tzOffsetMs;
          const startDate = new Date(realUtcTs);

          console.warn('Computed start date (Sweden local -> UTC):', { startDate, tzOffsetMs });
          if (!isNaN(startDate.getTime())) sub.startTime = startDate.toISOString().replace(/\.\d{3}Z$/, '+00:00');
        }

        if (endText) {
          const e = parseHM(endText);
          if (e) {
            const constructedEndUTC = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), e.hh, e.mm, 0);
            const realEndUtcTs = constructedEndUTC - tzOffsetMs;
            const endDate = new Date(realEndUtcTs);
            if (!isNaN(endDate.getTime())) sub.endTime = endDate.toISOString().replace(/\.\d{3}Z$/, '+00:00');
            else sub.endTime = null;
          } else {
            sub.endTime = null;
          }
        } else {
          sub.endTime = null;
        }
      } catch (err) {
        console.error('Time parse failure - debug info:', {
          eventId: ev && (ev.id || ev.value) ? ev.id || ev.value : undefined,
          eventTitle: ev && ev.title ? ev.title : undefined,
          line: ln,
          parsed,
          startText,
          endText,
          error: err && err.stack ? err.stack : String(err),
        });
        // stop all processing immediately to surface the issue
        try {
          // give any pending logs a moment (best-effort)
          setTimeout(() => process.exit(1), 0);
        } catch (e) {
          // fallback: throw to let upstream handlers catch
          throw err;
        }
      }

      subs.push(sub); // placeholder to ensure correct index for next sub
    }
  }

  return subs;
}
