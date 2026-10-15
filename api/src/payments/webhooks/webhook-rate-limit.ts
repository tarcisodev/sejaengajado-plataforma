import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { hashClientIp } from '../../public/sites/avaliar-rate-limit';

export const WEBHOOK_WINDOW_MS = 60_000;
export const WEBHOOK_LIMIT_PER_WINDOW = 60;

export { hashClientIp };

/** In-memory rate limit keyed by hashed IP (no raw IP stored). */
@Injectable()
export class WebhookRateLimit {
  private readonly hits = new Map<string, number[]>();

  assertAllowed(ipHash: string, now = Date.now()): void {
    const cutoff = now - WEBHOOK_WINDOW_MS;
    const recent = (this.hits.get(ipHash) ?? []).filter((ts) => ts > cutoff);
    if (recent.length >= WEBHOOK_LIMIT_PER_WINDOW) {
      this.hits.set(ipHash, recent);
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Muitas solicitações. Tente novamente em breve.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(ipHash, recent);
  }

  reset(): void {
    this.hits.clear();
  }
}
