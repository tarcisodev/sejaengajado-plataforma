import { BadRequestException } from '@nestjs/common';

/** Parse query limit/offset with integer check and hard cap (avoids NaN → 500). */
export function parseLimit(
  raw: string | undefined,
  opts: { defaultValue?: number; max?: number } = {},
): number {
  const defaultValue = opts.defaultValue ?? 20;
  const max = opts.max ?? 100;
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [{ path: 'limit', code: 'invalid', message: `limit deve ser inteiro 1..${max}` }],
    });
  }
  return Math.min(n, max);
}

export function parseOffset(raw: string | undefined, max = 10_000): number {
  if (raw === undefined || raw === '') {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [{ path: 'offset', code: 'invalid', message: 'offset deve ser inteiro ≥ 0' }],
    });
  }
  return Math.min(n, max);
}
