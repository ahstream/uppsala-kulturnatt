#!/usr/bin/env node
import { fetchEvents } from '../fetchEvents';
import { MINIMUM_FETCHED_EVENTS } from '../globals';
import fs from 'fs';
import path from 'path';

function parseArgs(): { url?: string; out?: string; headers?: Record<string, string>; data?: string; paginate?: boolean; startPage?: number; pageKey?: string } {
  const argv = process.argv.slice(2);
  let url: string | undefined;
  let out: string | undefined;
  let data: string | undefined;
  let paginate: boolean | undefined;
  let startPage: number | undefined;
  let pageKey: string | undefined;
  const headers: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && argv[i + 1]) {
      url = argv[i + 1];
      i++;
    } else if (a === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i++;
    } else if (a === '--data' && argv[i + 1]) {
      data = argv[i + 1];
      i++;
    } else if (a === '--paginate') {
      paginate = true;
    } else if (a === '--start-page' && argv[i + 1]) {
      startPage = parseInt(argv[i + 1], 10);
      i++;
    } else if (a === '--page-key' && argv[i + 1]) {
      pageKey = argv[i + 1];
      i++;
    } else if (a === '--header' && argv[i + 1]) {
      const h = argv[i + 1];
      i++;
      const idx = h.indexOf(':');
      if (idx !== -1) {
        const name = h.slice(0, idx).trim();
        const value = h.slice(idx + 1).trim();
        headers[name] = value;
      }
    }
  }
  return { url, out, headers: Object.keys(headers).length ? headers : undefined, data, paginate, startPage, pageKey };
}

async function main() {
  const args = parseArgs();
  const outPath = args.out ?? 'data/events.json';
  console.log(`Fetching events from ${args.url ?? 'default API'} ...`);
  try {
    let payload: any = undefined;
    if (args.data) {
      if (args.data.startsWith('@')) {
        const p = args.data.slice(1);
        const raw = fs.readFileSync(p, { encoding: 'utf-8' });
        payload = JSON.parse(raw);
      } else {
        payload = JSON.parse(args.data);
      }
    }

    const data = await fetchEvents({
      url: args.url,
      headers: args.headers,
      payload,
      paginate: args.paginate,
      startPage: args.startPage,
      pageKey: args.pageKey,
      onPage: (page, items, total) => console.log(`Fetched page ${page}/${total ?? '?'}: ${items} items`),
    });
    const eventCount = Array.isArray(data) ? data.length : 0;
    if (eventCount < MINIMUM_FETCHED_EVENTS) {
      throw new Error(`Expected at least ${MINIMUM_FETCHED_EVENTS} events, received ${eventCount}`);
    }
    const dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
    const stat = fs.statSync(outPath);
    console.log(`Saved ${outPath} (${stat.size} bytes)`);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}
