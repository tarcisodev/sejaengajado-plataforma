export interface Page<T> {
  items: T[];
  nextCursor: string | null;
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
