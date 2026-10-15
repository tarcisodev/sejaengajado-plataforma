import { Injectable } from '@nestjs/common';

interface CacheEntry {
  body: unknown;
  etag: string;
  expiresAt: number;
}

/**
 * In-memory by-host cache (60s). B8 serves from here; B7 invalidates on publish/edit.
 */
@Injectable()
export class ByHostCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(host: string): CacheEntry | undefined {
    const key = normalizeHost(host);
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  set(host: string, body: unknown, etag: string, ttlMs = 60_000): void {
    this.entries.set(normalizeHost(host), {
      body,
      etag,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidateSlug(slug: string): void {
    const needle = normalizeSlugHost(slug);
    for (const key of this.entries.keys()) {
      if (key === needle || key.startsWith(`${needle}.`)) {
        this.entries.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.entries.clear();
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? '';
}

function normalizeSlugHost(slug: string): string {
  return slug.trim().toLowerCase();
}
