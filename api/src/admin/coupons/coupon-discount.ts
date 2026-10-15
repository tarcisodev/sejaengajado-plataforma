import { roundCents } from '../../common/money';

export type CouponDiscountInput = {
  amountCents: number;
  type: 'PCT' | 'FIXED';
  value: number;
  active: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
  maxUses?: number | null;
  usedCount: number;
  at?: Date;
};

export type CouponDiscountResult =
  | {
      ok: true;
      discountCents: number;
      finalCents: number;
    }
  | {
      ok: false;
      discountCents: 0;
      finalCents: number;
      reason: string;
    };

/** Aplica cupom PCT/FIXED; o valor final nunca fica negativo. */
export function applyCouponDiscount(input: CouponDiscountInput): CouponDiscountResult {
  const amount = input.amountCents;
  if (!Number.isInteger(amount) || amount < 0) {
    return { ok: false, discountCents: 0, finalCents: 0, reason: 'amount_invalid' };
  }

  if (!input.active) {
    return { ok: false, discountCents: 0, finalCents: amount, reason: 'inactive' };
  }

  const at = input.at ?? new Date();
  if (input.validFrom && at < input.validFrom) {
    return { ok: false, discountCents: 0, finalCents: amount, reason: 'not_started' };
  }
  if (input.validTo && at > input.validTo) {
    return { ok: false, discountCents: 0, finalCents: amount, reason: 'expired' };
  }
  if (
    input.maxUses != null &&
    Number.isInteger(input.maxUses) &&
    input.usedCount >= input.maxUses
  ) {
    return { ok: false, discountCents: 0, finalCents: amount, reason: 'max_uses' };
  }

  let discountCents = 0;
  if (input.type === 'PCT') {
    if (!Number.isInteger(input.value) || input.value < 0 || input.value > 100) {
      return { ok: false, discountCents: 0, finalCents: amount, reason: 'pct_invalid' };
    }
    discountCents = roundCents((amount * input.value) / 100);
  } else {
    if (!Number.isInteger(input.value) || input.value < 0) {
      return { ok: false, discountCents: 0, finalCents: amount, reason: 'fixed_invalid' };
    }
    discountCents = input.value;
  }

  discountCents = Math.min(discountCents, amount);
  const finalCents = Math.max(0, amount - discountCents);
  return { ok: true, discountCents, finalCents };
}
