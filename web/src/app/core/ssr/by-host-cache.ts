export interface CachedByHost {
  status: number;
  body: Record<string, unknown> | null;
  storedAt: number;
}

const TTL_MS = 60_000;

/** In-memory by-host cache for the SSR Node process (60s). */
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
    return hit;
  }

  set(host: string, status: number, body: Record<string, unknown> | null): void {
    this.map.set(normalizeHost(host), { status, body, storedAt: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }
}

export const byHostMemoryCache = new ByHostMemoryCache();

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? '';
}
