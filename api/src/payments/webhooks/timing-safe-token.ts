import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time compare for Asaas `asaas-access-token`.
 * Unequal lengths still touch timingSafeEqual (on the expected buffer) to
 * avoid a trivial early-return timing oracle.
 */
export function tokensMatch(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) {
    return false;
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
