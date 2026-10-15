import { spLocalDate } from '../common/sao-paulo-time';

/** Invoice period `YYYY-MM` for the SP calendar month containing `at`. */
export function invoicePeriodSp(at: Date): string {
  return spLocalDate(at).slice(0, 7);
}

/** Previous SP calendar month period relative to `at`. */
export function previousInvoicePeriodSp(at: Date): string {
  const [year, month] = invoicePeriodSp(at).split('-').map(Number) as [number, number];
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** Idempotency-Key for reseller invoice charge (unique per reseller+period). */
export function resellerInvoiceIdempotencyKey(
  resellerId: string,
  period: string,
): string {
  return `reseller-invoice:${resellerId}:${period}`;
}

/** Idempotency-Key for direct customer charges. */
export function directChargeIdempotencyKey(
  kind: 'pronto' | 'pro' | 'renewal' | 'penalty',
  siteId: string,
  periodOrToken: string,
): string {
  return `direct:${kind}:${siteId}:${periodOrToken}`;
}
