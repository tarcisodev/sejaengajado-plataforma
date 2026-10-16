import { endOfDaySaoPauloIso, parseCouponDateInput } from './coupon-date';

describe('coupon-date', () => {
  it('maps YYYY-MM-DD to end of day America/Sao_Paulo as UTC ISO', () => {
    // 2026-06-09T23:59:59-03:00 → 2026-06-10T02:59:59.000Z
    expect(endOfDaySaoPauloIso('2026-06-09')).toBe('2026-06-10T02:59:59.000Z');
  });

  it('passes through datetime via parseCouponDateInput', () => {
    expect(parseCouponDateInput('2026-06-09T23:59:59-03:00')).toBe(
      '2026-06-10T02:59:59.000Z',
    );
  });

  it('normalizes pure date in parseCouponDateInput', () => {
    expect(parseCouponDateInput('2026-12-31')).toBe('2027-01-01T02:59:59.000Z');
  });
});
