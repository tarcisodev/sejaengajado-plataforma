import { applyCouponDiscount } from './coupon-discount';

describe('applyCouponDiscount', () => {
  const base = {
    amountCents: 10_000,
    active: true,
    usedCount: 0,
    at: new Date('2026-06-15T12:00:00.000Z'),
  };

  it('applies PCT and FIXED without going negative', () => {
    expect(
      applyCouponDiscount({ ...base, type: 'PCT', value: 10 }),
    ).toEqual({ ok: true, discountCents: 1000, finalCents: 9000 });

    expect(
      applyCouponDiscount({ ...base, type: 'FIXED', value: 2500 }),
    ).toEqual({ ok: true, discountCents: 2500, finalCents: 7500 });

    expect(
      applyCouponDiscount({ ...base, type: 'FIXED', value: 50_000 }),
    ).toEqual({ ok: true, discountCents: 10_000, finalCents: 0 });

    expect(
      applyCouponDiscount({ ...base, type: 'PCT', value: 100 }),
    ).toEqual({ ok: true, discountCents: 10_000, finalCents: 0 });
  });

  it('rejects inactive, expired, not started, max uses and invalid pct', () => {
    expect(
      applyCouponDiscount({ ...base, type: 'PCT', value: 10, active: false }).ok,
    ).toBe(false);

    const expired = applyCouponDiscount({
      ...base,
      type: 'FIXED',
      value: 100,
      validTo: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.reason).toBe('expired');
    }

    const notStarted = applyCouponDiscount({
      ...base,
      type: 'FIXED',
      value: 100,
      validFrom: new Date('2026-12-01T00:00:00.000Z'),
    });
    expect(notStarted.ok).toBe(false);
    if (!notStarted.ok) {
      expect(notStarted.reason).toBe('not_started');
    }

    const maxed = applyCouponDiscount({
      ...base,
      type: 'PCT',
      value: 10,
      maxUses: 2,
      usedCount: 2,
    });
    expect(maxed.ok).toBe(false);
    if (!maxed.ok) {
      expect(maxed.reason).toBe('max_uses');
    }

    const badPct = applyCouponDiscount({ ...base, type: 'PCT', value: 101 });
    expect(badPct.ok).toBe(false);
    if (!badPct.ok) {
      expect(badPct.reason).toBe('pct_invalid');
    }
  });

  it('rounds PCT to integer cents', () => {
    expect(
      applyCouponDiscount({
        amountCents: 100,
        type: 'PCT',
        value: 33,
        active: true,
        usedCount: 0,
      }),
    ).toEqual({ ok: true, discountCents: 33, finalCents: 67 });
  });
});
