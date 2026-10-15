import {
  directChargeIdempotencyKey,
  invoicePeriodSp,
  previousInvoicePeriodSp,
  resellerInvoiceIdempotencyKey,
} from './invoice-period';

describe('invoice-period', () => {
  it('computes SP YYYY-MM and previous month', () => {
    // 2026-03-15 15:00 UTC = 2026-03-15 12:00 SP
    const at = new Date('2026-03-15T15:00:00.000Z');
    expect(invoicePeriodSp(at)).toBe('2026-03');
    expect(previousInvoicePeriodSp(at)).toBe('2026-02');
    expect(previousInvoicePeriodSp(new Date('2026-01-10T15:00:00.000Z'))).toBe(
      '2025-12',
    );
  });

  it('builds stable idempotency keys', () => {
    expect(resellerInvoiceIdempotencyKey('r1', '2026-02')).toBe(
      'reseller-invoice:r1:2026-02',
    );
    expect(directChargeIdempotencyKey('pronto', 's1', '2026-03')).toBe(
      'direct:pronto:s1:2026-03',
    );
  });
});
