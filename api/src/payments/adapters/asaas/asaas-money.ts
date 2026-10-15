import { assertPositiveCents } from '../../domain/payment.types';

/**
 * Convert integer centavos to Asaas `value` (BRL with 2 decimals).
 * Builds the number from integer parts — no parseFloat/Decimal.
 */
export function centsToAsaasValue(amountCents: number): number {
  assertPositiveCents(amountCents);
  const whole = Math.trunc(amountCents / 100);
  const frac = amountCents % 100;
  return Number(`${whole}.${String(frac).padStart(2, '0')}`);
}

/** Convert Asaas BRL value back to integer centavos. */
export function asaasValueToCents(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('valor Asaas inválido');
  }
  const [wholePart, fracPart = '0'] = value.toFixed(2).split('.');
  const whole = Number(wholePart);
  const frac = Number(fracPart.padEnd(2, '0').slice(0, 2));
  if (!Number.isInteger(whole) || !Number.isInteger(frac)) {
    throw new Error('valor Asaas inválido');
  }
  return whole * 100 + frac;
}
