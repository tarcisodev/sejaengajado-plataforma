export interface CachedByHost {
  status: number;
  body: Record<string, unknown> | null;
  storedAt: number;
  /** Per-entry TTL — negatives stay short so publish after 404 recovers fast. */
  ttlMs: number;
}

/** Successful by-host payloads. */
export const BY_HOST_TTL_OK_MS = 60_000;
/** 404/410/5xx/empty — keep brief (seconds), not a minute. */
export const BY_HOST_TTL_NEGATIVE_MS = 3_000;
/** Cap so wildcard traffic cannot grow the SSR process without bound. */
const MAX_ENTRIES = 500;

function ttlForStatus(status: number, body: Record<string, unknown> | null): number {
  if (status >= 200 && status < 300 && body) {
    return BY_HOST_TTL_OK_MS;
  }
  // Negatives: keep brief (publish-after-miss must recover in seconds).
  return BY_HOST_TTL_NEGATIVE_MS;
}

/** In-memory by-host cache for the SSR Node process. */
export class ByHostMemoryCache {
  private readonly map = new Map<string, CachedByHost>();

  get(host: string): CachedByHost | null {
    const key = normalizeHost(host);
    const hit = this.map.get(key);
    if (!hit) {
      return null;
    }
    if (Date.now() - hit.storedAt > hit.ttlMs) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  set(host: string, status: number, body: Record<string, unknown> | null): void {
    // Never persist hard misses — Nest 304/empty or brief API blips must not stick.
    if (status === 404 || status === 410 || status === 304) {
      return;
    }
    const key = normalizeHost(host);
    this.map.delete(key);
    this.map.set(key, {
      status,
      body,
      storedAt: Date.now(),
      ttlMs: ttlForStatus(status, body),
    });
    this.evictExpired();
    while (this.map.size > MAX_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now - entry.storedAt > entry.ttlMs) {
        this.map.delete(key);
      }
    }
  }
}

export const byHostMemoryCache = new ByHostMemoryCache();

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '').split(':')[0] ?? '';
}

/** Canonical public host for a tenant slug (always use this for by-host API calls). */
export function canonicalTenantHost(slug: string): string {
  return `${slug.trim().toLowerCase()}.sejaengajado.com.br`;
}
