import type { PaymentStatus as DbPaymentStatus } from '@prisma/client';

import type { PaymentStatus as GatewayStatus } from '../domain/payment.types';

/**
 * DB payment statuses (schema). Gateway CONFIRMED/RECEIVED both map to PAID;
 * RECEIVED after CONFIRMED is a no-op (no regression).
 */
export type ApplyResult =
  | { ok: true; next: DbPaymentStatus; changed: boolean }
  | { ok: false; reason: 'INVALID_TRANSITION' };

const RANK: Record<DbPaymentStatus, number> = {
  PENDING: 0,
  FAILED: 0,
  PAID: 1,
  REFUNDED: 2,
};

/** Map gateway reconsulta status → DB status. */
export function gatewayStatusToDb(status: GatewayStatus): DbPaymentStatus {
  switch (status) {
    case 'CONFIRMED':
    case 'RECEIVED':
      return 'PAID';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED';
    case 'OVERDUE':
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

export function canTransition(
  from: DbPaymentStatus,
  to: DbPaymentStatus,
): boolean {
  if (from === to) {
    return true;
  }
  if (from === 'REFUNDED') {
    return false;
  }
  if (from === 'PAID') {
    return to === 'REFUNDED';
  }
  if (from === 'PENDING' || from === 'FAILED') {
    return to === 'PAID' || to === 'FAILED' || to === 'REFUNDED';
  }
  return false;
}

/**
 * Apply a gateway-observed status onto the current DB status.
 * Rejects regressions (e.g. PAID → PENDING) and invalid jumps.
 */
export function applyPaymentTransition(
  current: DbPaymentStatus,
  gatewayStatus: GatewayStatus,
): ApplyResult {
  const next = gatewayStatusToDb(gatewayStatus);
  if (current === next) {
    return { ok: true, next, changed: false };
  }
  if (!canTransition(current, next)) {
    return { ok: false, reason: 'INVALID_TRANSITION' };
  }
  // Extra guard: never decrease rank (PAID must not become PENDING/FAILED).
  if (RANK[next]! < RANK[current]!) {
    return { ok: false, reason: 'INVALID_TRANSITION' };
  }
  return { ok: true, next, changed: true };
}
