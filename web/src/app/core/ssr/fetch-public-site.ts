import { byHostMemoryCache, normalizeHost, type CachedByHost } from './by-host-cache';

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

export function classifyPublicSite(
  status: number,
  body: Record<string, unknown> | null,
): PublicSiteFetchResult {
  if (status === 410) {
    return { kind: 'archived' };
  }
  if (status === 404 || !body) {
    return { kind: 'not-found' };
  }
  if (status >= 500) {
    return { kind: 'error', status };
  }
  const siteStatus = String(body['status'] ?? '');
  const unavailable = Boolean(body['temporarilyUnavailable']) || siteStatus === 'SUSPENDED';
  if (unavailable) {
    return { kind: 'suspended', body };
  }
  return { kind: 'ok', status, body };
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
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
    });
    let body: Record<string, unknown> | null = null;
    if (response.status !== 404 && response.status !== 410) {
      try {
        body = (await response.json()) as Record<string, unknown>;
      } catch {
        body = null;
      }
    }
    const entry: CachedByHost = {
      status: response.status,
      body,
      storedAt: Date.now(),
    };
    cache.set(normalized, entry.status, entry.body);
    return classifyPublicSite(entry.status, entry.body);
  } catch {
    return { kind: 'error', status: 502 };
  }
}

export function businessNameFromBody(body: Record<string, unknown>): string {
  const content = body['content'] as { businessName?: string } | undefined;
  if (content?.businessName) {
    return content.businessName;
  }
  return String(body['slug'] ?? 'Negócio');
}
