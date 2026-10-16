/** Convert Melhor Envio BRL (string|number) to integer centavos. */
export function brlToCents(value: number | string): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('valor Melhor Envio inválido');
  }
  return Math.round(n * 100);
}

/** Centavos → Melhor Envio insurance_value (BRL, 2 decimals). */
export function centsToBrl(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('centavos inválidos');
  }
  return cents / 100;
}
