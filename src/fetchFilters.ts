import axios from 'axios';

export interface FetchFiltersOptions {
  url?: string;
  rateLimitMs?: number;
  headers?: Record<string, string>;
  payload?: any;
  method?: 'GET' | 'POST';
}

const DEFAULT_URL = 'https://kulturnatten.uppsala.se/api/events/filters?culture=sv';
const DEFAULT_RATE_LIMIT_MS = 1000;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchOnce(url: string, method: 'GET' | 'POST' = 'GET', rateLimitMs = DEFAULT_RATE_LIMIT_MS, headers: Record<string, string> | undefined = undefined, data: any = undefined) {
  await sleep(rateLimitMs);
  const opts: any = { timeout: 30000 };
  if (headers) opts.headers = headers;

  if (method === 'GET') {
    const r = await axios.get(url, opts);
    return r.data;
  }
  const postOpts = { timeout: 60000 } as any;
  if (headers) postOpts.headers = headers;
  const body = data !== undefined ? data : {};
  const r = await axios.post(url, body, postOpts);
  return r.data;
}

async function fetchAll(url: string, rateLimitMs = DEFAULT_RATE_LIMIT_MS, headers?: Record<string, string>, data: any = undefined, preferPost = false) {
  if (preferPost) {
    try {
      return await fetchOnce(url, 'POST', rateLimitMs, headers, data);
    } catch (err) {
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
    try {
      return await fetchOnce(url, 'POST', rateLimitMs, headers, data);
    } catch (e) {
      throw new Error(`Failed to fetch from ${url}: ${e}`);
    }
  }
}

export async function fetchFilters(opts: FetchFiltersOptions = {}) {
  const url = opts.url ?? DEFAULT_URL;
  const rateLimitMs = opts.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  const payload = opts.payload ?? {};

  const defaultHeaders: Record<string, string> = {
    Accept: '*/*',
    'Accept-Language': 'sv,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json',
    Pragma: 'no-cache',
    Referer: 'https://kulturnatten.uppsala.se/',
    Origin: 'https://kulturnatten.uppsala.se',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  };

  const headers = opts.headers ? { ...defaultHeaders, ...opts.headers } : defaultHeaders;

  const preferPost = !!payload;
  const data = await fetchAll(url, rateLimitMs, headers, payload, preferPost);
  return data;
}
