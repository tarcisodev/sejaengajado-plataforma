const SP = 'America/Sao_Paulo';

/** Instant corresponding to calendar day YYYY-MM-DD at 00:00 in America/Sao_Paulo. */
export function spDayStartUtc(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  // SP is UTC-3 year-round (no DST since 2019).
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

export function asOfInSaoPaulo(at?: Date): Date {
  return at ?? new Date();
}
