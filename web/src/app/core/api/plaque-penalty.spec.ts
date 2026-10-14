import { calculatePlaquePenalty } from './plaque-penalty';

describe('calculatePlaquePenalty', () => {
  const value = 8_000;
  const pct = 100;
  const today = new Date('2027-05-01T15:00:00.000Z');

  it('rounds only the month up and keeps integer cents', () => {
    const quote = calculatePlaquePenalty('2027-06-15', today, value, pct);

    expect(quote.diasRestantes).toBe(45);
    expect(quote.mesesRestantes).toBe(2);
    expect(quote.multaCentavos).toBe(1333);
  });

  it('counts an exact 30-day span as one month', () => {
    const quote = calculatePlaquePenalty('2027-05-31', today, value, pct);

    expect(quote.diasRestantes).toBe(30);
    expect(quote.mesesRestantes).toBe(1);
    expect(quote.multaCentavos).toBe(666);
  });

  it('rounds 31 days up to two months', () => {
    const quote = calculatePlaquePenalty('2027-06-01', today, value, pct);

    expect(quote.diasRestantes).toBe(31);
    expect(quote.mesesRestantes).toBe(2);
    expect(quote.multaCentavos).toBe(1333);
  });

  it('charges nothing when fidelity ends today or earlier', () => {
    expect(calculatePlaquePenalty('2027-05-01', today, value, pct).multaCentavos).toBe(0);
    expect(calculatePlaquePenalty('2027-04-30', today, value, pct).multaCentavos).toBe(0);
    expect(calculatePlaquePenalty(null, today, value, pct).multaCentavos).toBe(0);
  });

  it('applies plaquePenaltyPct inside the integer division', () => {
    const quote = calculatePlaquePenalty('2027-06-15', today, value, 50);

    expect(quote.multaCentavos).toBe(666);
  });
});
