/**
 * Normaliza validade de cupom para ISO UTC no fim do dia America/Sao_Paulo.
 * Brasil sem DST desde 2019 → offset fixo -03:00.
 */
export function endOfDaySaoPauloIso(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59-03:00`).toISOString();
  }
  return new Date(trimmed).toISOString();
}

/** Aceita datetime ISO ou date YYYY-MM-DD (normaliza para fim do dia -03:00). */
export function parseCouponDateInput(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return endOfDaySaoPauloIso(trimmed);
  }
  const asDate = new Date(trimmed);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error('invalid_date');
  }
  return asDate.toISOString();
}
