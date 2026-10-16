import { byHostMemoryCache, canonicalTenantHost, normalizeHost } from './by-host-cache';

export type PublicSiteFetchResult =
  | { kind: 'ok'; status: number; body: Record<string, unknown> }
  | { kind: 'suspended'; body: Record<string, unknown> }
  | { kind: 'archived' }
  | { kind: 'not-found' }
  | { kind: 'error'; status: number };

export function apiInternalBase(): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const fromEnv = (proc?.env?.['API_INTERNAL_URL'] ?? '').trim().replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }
  return 'http://127.0.0.1:3000';
}

/** Absolute Nest base for Angular SSR HttpClient (tenant Host has no Traefik /api route). */
export function apiInternalUrlForSsr(): string {
  return `${apiInternalBase()}/api`;
}

export function classifyPublicSite(
  status: number,
  body: Record<string, unknown> | null,
): PublicSiteFetchResult {
  if (status === 410) {
    return { kind: 'archived' };
  }
  if (status === 404) {
    return { kind: 'not-found' };
  }
  if (status >= 500) {
    return { kind: 'error', status };
  }
  // 2xx/3xx without JSON is a transport glitch — not "site missing".
  if (!body) {
    return { kind: 'error', status: status || 502 };
  }
  const siteStatus = String(body['status'] ?? '');
  const unavailable = Boolean(body['temporarilyUnavailable']) || siteStatus === 'SUSPENDED';
  if (unavailable) {
    return { kind: 'suspended', body };
  }
  return { kind: 'ok', status, body };
}

/**
 * Fetch public site by tenant slug (canonical host). Prefer this over raw Host headers
 * that may include trailing dots / X-Forwarded quirks behind Cloudflare→Traefik.
 */
export async function fetchPublicSiteBySlug(
  slug: string,
  fetchImpl: typeof fetch = fetch,
  cache = byHostMemoryCache,
): Promise<PublicSiteFetchResult> {
  return fetchPublicSiteByHost(canonicalTenantHost(slug), fetchImpl, cache);
}

const FETCH_ATTEMPTS = 4;
/** Brief pause before retrying a soft miss (Nest blip / rolling deploy). */
const RETRY_PAUSE_MS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number, body: Record<string, unknown> | null): boolean {
  if (status === 304 || status === 404 || status === 429) {
    return true;
  }
  if (status >= 500) {
    return true;
  }
  return status >= 200 && status < 300 && !body;
}

export async function fetchPublicSiteByHost(
  host: string,
  fetchImpl: typeof fetch = fetch,
  cache = byHostMemoryCache,
): Promise<PublicSiteFetchResult> {
  const normalized = normalizeHost(host);
  const cached = cache.get(normalized);
  if (cached) {
    return classifyPublicSite(cached.status, cached.body);
  }

  const url = `${apiInternalBase()}/api/public/sites/by-host?host=${encodeURIComponent(normalized)}`;
  let lastError: PublicSiteFetchResult = { kind: 'error', status: 502 };

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
      });
      // 304 without body must not be treated as "site missing".
      if (response.status === 304) {
        lastError = { kind: 'error', status: 502 };
        if (attempt < FETCH_ATTEMPTS) {
          await sleep(RETRY_PAUSE_MS * attempt);
          continue;
        }
        return lastError;
      }
      let body: Record<string, unknown> | null = null;
      if (response.status !== 404 && response.status !== 410 && response.status !== 429) {
        try {
          body = (await response.json()) as Record<string, unknown>;
        } catch {
          body = null;
        }
      }
      // Retry soft misses — brief Nest/DNS blips must not sticky-404 the biosite (CDN+UA).
      if (shouldRetryStatus(response.status, body) && attempt < FETCH_ATTEMPTS) {
        lastError =
          response.status === 404
            ? { kind: 'not-found' }
            : classifyPublicSite(response.status === 429 ? 502 : response.status, body);
        await sleep(RETRY_PAUSE_MS * attempt);
        continue;
      }
      cache.set(normalized, response.status, body);
      return classifyPublicSite(response.status, body);
    } catch {
      lastError = { kind: 'error', status: 502 };
      if (attempt < FETCH_ATTEMPTS) {
        await sleep(RETRY_PAUSE_MS * attempt);
        continue;
      }
    }
  }
  return lastError;
}

export function businessNameFromBody(body: Record<string, unknown>): string {
  const content = body['content'] as { businessName?: string } | undefined;
  if (content?.businessName) {
    return content.businessName;
  }
  return String(body['slug'] ?? 'Negócio');
}
