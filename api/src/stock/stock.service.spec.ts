import { averageCostCents } from './stock.service';

describe('StockService helpers', () => {
  it('computes integer average cost', () => {
    expect(averageCostCents(1000, 3)).toBe(333);
    expect(averageCostCents(1000, 4)).toBe(250);
    expect(averageCostCents(0, 0)).toBe(0);
  });
});
