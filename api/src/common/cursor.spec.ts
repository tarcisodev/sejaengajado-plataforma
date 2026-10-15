import { paginate } from './cursor';

describe('paginate', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('returns a cursor when another page remains', () => {
    expect(paginate(rows, 2, (row) => row.id)).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      nextCursor: 'b',
    });
  });

  it('returns a null cursor on the last page', () => {
    expect(paginate(rows, 3, (row) => row.id)).toEqual({
      items: rows,
      nextCursor: null,
    });
  });
});
