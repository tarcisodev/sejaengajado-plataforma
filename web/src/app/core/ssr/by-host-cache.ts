export interface CachedByHost {
  status: number;
  body: Record<string, unknown> | null;
  storedAt: number;
}

const TTL_MS = 60_000;
/** Cap so wildcard traffic cannot grow the SSR process without bound. */
const MAX_ENTRIES = 500;

/** In-memory by-host cache for the SSR Node process (60s TTL, max 500 hosts). */
export class ByHostMemoryCache {
  private readonly map = new Map<string, CachedByHost>();

  get(host: string): CachedByHost | null {
    const key = normalizeHost(host);
    const hit = this.map.get(key);
    if (!hit) {
      return null;
    }
    if (Date.now() - hit.storedAt > TTL_MS) {
      this.map.delete(key);
      return null;
    }
    // Refresh insertion order for LRU eviction on set.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  set(host: string, status: number, body: Record<string, unknown> | null): void {
    const key = normalizeHost(host);
    this.map.delete(key);
    this.map.set(key, { status, body, storedAt: Date.now() });
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

  /** Test helper. */
  get size(): number {
    return this.map.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now - entry.storedAt > TTL_MS) {
        this.map.delete(key);
      }
    }
  }
}

export const byHostMemoryCache = new ByHostMemoryCache();

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? '';
}
