import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export const AVALIAR_WINDOW_MS = 60_000;
export const AVALIAR_LIMIT_PER_WINDOW = 30;

export function hashClientIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * In-memory rate limit keyed by hashed IP, plus ScanEvent dedupe per site+hash
 * inside the same window. No raw IP is stored.
 */
@Injectable()
export class AvaliarRateLimit {
  private readonly hits = new Map<string, number[]>();
  private readonly recordedScans = new Map<string, number>();

  /** Throws RATE_LIMITED (429) when the hashed IP exceeds 30 hits / minute. */
  assertAllowed(ipHash: string, now = Date.now()): void {
    const cutoff = now - AVALIAR_WINDOW_MS;
    const recent = (this.hits.get(ipHash) ?? []).filter((ts) => ts > cutoff);
    if (recent.length >= AVALIAR_LIMIT_PER_WINDOW) {
      this.hits.set(ipHash, recent);
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Muitas solicitações. Tente novamente em breve.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(ipHash, recent);
  }

  /** Returns true when a new ScanEvent should be written for this site+IP hash. */
  shouldRecordScan(siteId: string, ipHash: string, now = Date.now()): boolean {
    const key = `${siteId}:${ipHash}`;
    const last = this.recordedScans.get(key);
    if (last !== undefined && now - last < AVALIAR_WINDOW_MS) {
      return false;
    }
    this.recordedScans.set(key, now);
    return true;
  }

  /** Test helper — clears all windows. */
  reset(): void {
    this.hits.clear();
    this.recordedScans.clear();
  }
}
