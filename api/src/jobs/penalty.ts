/** Multa da placa: ceil(plaqueValueCents × mesesRestantes/12 × pct/100). */
export function plaquePenaltyCents(
  plaqueValueCents: number,
  monthsRemaining: number,
  penaltyPct: number,
): number {
  if (
    !Number.isFinite(plaqueValueCents) ||
    !Number.isFinite(monthsRemaining) ||
    !Number.isFinite(penaltyPct)
  ) {
    throw new Error('Valor inválido');
  }
  const months = Math.max(0, Math.min(12, Math.floor(monthsRemaining)));
  if (months === 0 || plaqueValueCents <= 0 || penaltyPct <= 0) {
    return 0;
  }
  return Math.ceil((plaqueValueCents * months * penaltyPct) / (12 * 100));
}

/**
 * Meses restantes de fidelidade (0–12), arredondados para cima
 * (contrib-nucleo / Alicerce §4).
 */
export function monthsRemainingFidelity(from: Date, fidelityEndsAt: Date): number {
  if (fidelityEndsAt.getTime() <= from.getTime()) {
    return 0;
  }
  const years = fidelityEndsAt.getUTCFullYear() - from.getUTCFullYear();
  const months = fidelityEndsAt.getUTCMonth() - from.getUTCMonth();
  let total = years * 12 + months;
  if (fidelityEndsAt.getUTCDate() > from.getUTCDate()) {
    total += 1;
  }
  // endDay < startDay: `total` already counts the incomplete month (ceil).
  // endDay === startDay: exact whole months.
  return Math.max(0, Math.min(12, total));
}
