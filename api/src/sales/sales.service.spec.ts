import { predictedMarginCents } from './sales.service';

describe('SalesService margin', () => {
  it('computes predicted margin for mixed items including negative', () => {
    expect(
      predictedMarginCents([
        { qty: 2, unitPriceCents: 1000, unitCostCents: 400 },
        { qty: 1, unitPriceCents: 100, unitCostCents: 300 },
        { qty: 3, unitPriceCents: 500, unitCostCents: 500 },
      ]),
    ).toBe(2 * 600 + 1 * -200 + 0);
  });
});
