import { roundCents } from './money';

describe('roundCents', () => {
  it('rounds half away from zero once', () => {
    expect(roundCents(10.5)).toBe(11);
    expect(roundCents(10.4)).toBe(10);
    expect(roundCents(10)).toBe(10);
  });

  it('rejects a non-finite amount', () => {
    expect(() => roundCents(Number.NaN)).toThrow('Valor inválido');
  });
});
