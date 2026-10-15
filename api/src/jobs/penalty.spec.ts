import { monthsRemainingFidelity, plaquePenaltyCents } from './penalty';

describe('plaquePenaltyCents', () => {
  it('computes ceil penalty for 0, 1 and 12 months remaining', () => {
    expect(plaquePenaltyCents(9900, 0, 100)).toBe(0);
    expect(plaquePenaltyCents(9900, 1, 100)).toBe(Math.ceil((9900 * 1 * 100) / 1200));
    expect(plaquePenaltyCents(9900, 12, 100)).toBe(9900);
    expect(plaquePenaltyCents(9900, 12, 50)).toBe(Math.ceil((9900 * 12 * 50) / 1200));
  });
});

describe('monthsRemainingFidelity', () => {
  it('returns 0 when fidelity already ended', () => {
    expect(
      monthsRemainingFidelity(
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-05-01T00:00:00.000Z'),
      ),
    ).toBe(0);
  });

  it('ceils partial months and clamps to 12', () => {
    expect(
      monthsRemainingFidelity(
        new Date('2026-01-20T00:00:00.000Z'),
        new Date('2026-02-10T00:00:00.000Z'),
      ),
    ).toBe(1);
    expect(
      monthsRemainingFidelity(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-02-01T00:00:00.000Z'),
      ),
    ).toBe(1);
    expect(
      monthsRemainingFidelity(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2028-01-01T00:00:00.000Z'),
      ),
    ).toBe(12);
  });
});
