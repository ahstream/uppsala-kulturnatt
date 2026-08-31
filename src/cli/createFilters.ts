#!/usr/bin/env node
import { fetchFilters } from '../fetchFilters';
import fs from 'fs';
import path from 'path';

function parseArgs(): { url?: string; out?: string; headers?: Record<string, string>; data?: string } {
  const argv = process.argv.slice(2);
  let url: string | undefined;
  let out: string | undefined;
  let data: string | undefined;
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
  return { url, out, headers: Object.keys(headers).length ? headers : undefined, data };
}

async function main() {
  const args = parseArgs();
  const outPath = args.out ?? 'data/filters.json';
  console.log(`Fetching filters from ${args.url ?? 'default API'} ...`);
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

    const resp = await fetchFilters({ url: args.url, headers: args.headers, payload });
    const filters = {
      categories: resp && (resp.categories || resp.category) ? resp.categories || resp.category : [],
      locations: resp && (resp.locations || resp.places || resp.locationsList) ? resp.locations || resp.places || resp.locationsList : [],
      languages: resp && (resp.languages || resp.language) ? resp.languages || resp.language : [],
      accessibilities: resp && (resp.accessibilities || resp.accessibility) ? resp.accessibilities || resp.accessibility : [],
    };
    const dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(filters, null, 2), { encoding: 'utf-8' });
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
