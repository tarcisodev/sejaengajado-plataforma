import { HttpException } from '@nestjs/common';

import {
  AVALIAR_LIMIT_PER_WINDOW,
  AvaliarRateLimit,
  hashClientIp,
} from './avaliar-rate-limit';

describe('AvaliarRateLimit', () => {
  it('hashes IP and never stores the raw value as a key', () => {
    const raw = '203.0.113.50';
    const hash = hashClientIp(raw);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(raw);

    const limiter = new AvaliarRateLimit();
    limiter.assertAllowed(hash);
    expect(limiter.shouldRecordScan('site-1', hash)).toBe(true);
  });

  it('rate-limits at 30 hits per hashed IP per minute', () => {
    const limiter = new AvaliarRateLimit();
    const ipHash = hashClientIp('198.51.100.10');
    const t0 = 1_000_000;
    for (let i = 0; i < AVALIAR_LIMIT_PER_WINDOW; i += 1) {
      limiter.assertAllowed(ipHash, t0 + i);
    }
    expect(() => limiter.assertAllowed(ipHash, t0 + AVALIAR_LIMIT_PER_WINDOW)).toThrow(
      HttpException,
    );
  });

  it('dedupes ScanEvent in the same window for the same site+hash', () => {
    const limiter = new AvaliarRateLimit();
    const ipHash = hashClientIp('198.51.100.20');
    const t0 = 2_000_000;
    expect(limiter.shouldRecordScan('site-a', ipHash, t0)).toBe(true);
    expect(limiter.shouldRecordScan('site-a', ipHash, t0 + 1_000)).toBe(false);
    expect(limiter.shouldRecordScan('site-b', ipHash, t0 + 1_000)).toBe(true);
    expect(limiter.shouldRecordScan('site-a', ipHash, t0 + 60_000)).toBe(true);
  });
});
