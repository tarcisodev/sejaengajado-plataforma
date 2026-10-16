/**
 * Converte validade YYYY-MM-DD para ISO UTC no fim do dia America/Sao_Paulo.
 * Ex.: 2026-06-09 → 2026-06-09T23:59:59-03:00 → toISOString().
 */
export function endOfDaySaoPauloIso(dateOnly: string): string {
  const trimmed = dateOnly.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59-03:00`).toISOString();
  }
  return new Date(trimmed).toISOString();
}
