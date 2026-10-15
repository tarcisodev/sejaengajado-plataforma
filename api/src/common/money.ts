export function roundCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Valor inválido');
  }
  return Math.round(value);
}
