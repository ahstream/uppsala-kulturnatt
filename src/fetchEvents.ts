import axios from 'axios';
import { RATE_LIMIT_MS } from './globals';

export interface FetchOptions {
  url?: string;
  rateLimitMs?: number;
  headers?: Record<string, string>;
  payload?: any;
  method?: 'GET' | 'POST';
  paginate?: boolean;
  startPage?: number;
  pageKey?: string;
  onPage?: (page: number, items: number, totalPages?: number) => void;
}

const DEFAULT_URL = 'https://kulturnatten.uppsala.se/api/events/search';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function normalizeLineTerminators(value: any): any {
  if (typeof value === 'string') return value.replace(/[\u0085\u2028\u2029]/g, '\n');
  if (Array.isArray(value)) return value.map(normalizeLineTerminators);
  if (!value || typeof value !== 'object') return value;

  for (const key of Object.keys(value)) value[key] = normalizeLineTerminators(value[key]);
  return value;
}

async function fetchOnce(url: string, method: 'GET' | 'POST' = 'GET', rateLimitMs = RATE_LIMIT_MS, headers: Record<string, string> | undefined = undefined, data: any = undefined) {
  await sleep(rateLimitMs);
  const opts: any = { timeout: 30000 };
  if (headers) opts.headers = headers;

  if (method === 'GET') {
    const r = await axios.get(url, opts);
    return r.data;
  }
  const postOpts = { timeout: 60000 } as any;
  if (headers) postOpts.headers = headers;
  const body = data !== undefined ? data : { size: 10000 };
  const r = await axios.post(url, body, postOpts);
  return r.data;
}

async function fetchAll(url: string, rateLimitMs = RATE_LIMIT_MS, headers?: Record<string, string>, data: any = undefined, preferPost = false) {
  if (preferPost) {
    try {
      return await fetchOnce(url, 'POST', rateLimitMs, headers, data);
    } catch (err) {
      // fallback to GET
      try {
        return await fetchOnce(url, 'GET', rateLimitMs, headers);
      } catch (e) {
        throw new Error(`Failed to fetch from ${url}: ${e}`);
      }
    }
  }

  try {
    return await fetchOnce(url, 'GET', rateLimitMs, headers);
  } catch (err) {
    // fallback to POST
    try {
      return await fetchOnce(url, 'POST', rateLimitMs, headers, data);
    } catch (e) {
      throw new Error(`Failed to fetch from ${url}: ${e}`);
    }
  }
}

export async function fetchEvents(opts: FetchOptions = {}) {
  const url = opts.url ?? DEFAULT_URL;
  const rateLimitMs = opts.rateLimitMs ?? RATE_LIMIT_MS;
  const payload = opts.payload ?? {};
  const method = opts.method;
  const paginate = opts.paginate ?? true;
  const checked = Date.now();

  const defaultHeaders: Record<string, string> = {
    Accept: '*/*',
    'Accept-Language': 'sv,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,la;q=0.6,da;q=0.5,de;q=0.4',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json',
    Pragma: 'no-cache',
    Referer: 'https://kulturnatten.uppsala.se/',
    Origin: 'https://kulturnatten.uppsala.se',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };

  const headers = opts.headers ? { ...defaultHeaders, ...opts.headers } : defaultHeaders;

  const preferPost = !!payload || method === 'POST';
  // auto-paginate by default (unless explicitly disabled)
  if (paginate) {
    const pageKey = opts.pageKey ?? 'page';
    let page = opts.startPage ?? 1;
    const collected: any[] = [];
    while (true) {
      const payloadWithPage = payload ? { ...payload, [pageKey]: page } : { [pageKey]: page };
      const d = await fetchAll(url, rateLimitMs, headers, payloadWithPage, true);

      // try to find an array of items in common response shapes
      let items: any[] | undefined;
      if (Array.isArray(d)) items = d as any[];
      else if (d && Array.isArray((d as any).events)) items = (d as any).events;
      else if (d && Array.isArray((d as any).items)) items = (d as any).items;
      else if (d && Array.isArray((d as any).data)) items = (d as any).data;
      else if (d && Array.isArray((d as any).results)) items = (d as any).results;

      const itemCount = items ? items.length : 0;

      // determine total pages if present
      const totalPagesTop = d && typeof (d as any).totalPages === 'number' ? (d as any).totalPages : undefined;
      const meta = (d && ((d as any).meta || (d as any).pagination)) as any | undefined;
      const totalPagesFromMeta = meta && typeof meta.totalPages === 'number' ? meta.totalPages : undefined;
      const totalPages = totalPagesTop ?? totalPagesFromMeta;

      if (opts.onPage) {
        try {
          opts.onPage(page, itemCount, totalPages);
        } catch (_) {
          // ignore
        }
      }

      if (!items || items.length === 0) break;
      collected.push(...items);

      // check pagination metadata if available (top-level or nested)
      const pageNumberTop = d && typeof (d as any).pageNumber === 'number' ? (d as any).pageNumber : undefined;

      if (typeof pageNumberTop === 'number' && typeof totalPagesTop === 'number') {
        if (pageNumberTop >= totalPagesTop) break;
      } else if (meta) {
        if (typeof meta.page === 'number' && typeof meta.totalPages === 'number') {
          if (meta.page >= meta.totalPages) break;
        }
      }

      // advance page
      page++;
    }

    // add url property to each collected event
    const baseUrl = 'https://kulturnatten.uppsala.se/program/event/?externalId=';
    for (const it of collected) {
      try {
        const eid = it && (it.id ?? it.value) ? (it.id ?? it.value) : '';
        it.url = `${baseUrl}${eid}`;
        it.checked = checked;
      } catch (_e) {
        // ignore
      }
    }

    return normalizeLineTerminators(collected);
  }

  const data = normalizeLineTerminators(await fetchAll(url, rateLimitMs, headers, payload, preferPost));
  const baseUrl = 'https://kulturnatten.uppsala.se/program/event/?externalId=';
  // attach url when returning arrays or known shapes
  if (Array.isArray(data)) {
    for (const it of data) {
      try {
        const eid = it && (it.id ?? it.value) ? (it.id ?? it.value) : '';
        it.url = `${baseUrl}${eid}`;
        it.checked = checked;
      } catch (_e) {}
    }
    return data;
  }

  // common wrappers
  if (data && Array.isArray((data as any).events)) {
    for (const it of (data as any).events) {
      try {
        const eid = it && (it.id ?? it.value) ? (it.id ?? it.value) : '';
        it.url = `${baseUrl}${eid}`;
        it.checked = checked;
      } catch (_e) {}
    }
    return (data as any).events;
  }
  if (data && Array.isArray((data as any).items)) {
    for (const it of (data as any).items) {
      try {
        const eid = it && (it.id ?? it.value) ? (it.id ?? it.value) : '';
        it.url = `${baseUrl}${eid}`;
        it.checked = checked;
      } catch (_e) {}
    }
    return (data as any).items;
  }
  if (data && Array.isArray((data as any).data)) {
    for (const it of (data as any).data) {
      try {
        const eid = it && (it.id ?? it.value) ? (it.id ?? it.value) : '';
        it.url = `${baseUrl}${eid}`;
        it.checked = checked;
      } catch (_e) {}
    }
    return (data as any).data;
  }
  if (data && Array.isArray((data as any).results)) {
    for (const it of (data as any).results) {
      try {
        const eid = it && (it.id ?? it.value) ? (it.id ?? it.value) : '';
        it.url = `${baseUrl}${eid}`;
        it.checked = checked;
      } catch (_e) {}
    }
    return (data as any).results;
  }

  return data;
}
