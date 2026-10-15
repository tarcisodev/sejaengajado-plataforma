export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface TimeIdCursor {
  createdAt: Date;
  id: string;
}

export function paginate<T>(
  rows: readonly T[],
  limit: number,
  cursorOf: (row: T) => string,
): Page<T> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Limite inválido');
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? cursorOf(last) : null,
  };
}

export function encodeTimeIdCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()},${id}`, 'utf8').toString('base64url');
}

export function decodeTimeIdCursor(cursor: string): TimeIdCursor {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const split = raw.indexOf(',');
  if (split <= 0) {
    throw new Error('Cursor inválido');
  }
  const createdAt = new Date(raw.slice(0, split));
  const id = raw.slice(split + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) {
    throw new Error('Cursor inválido');
  }
  return { createdAt, id };
}
