import { endOfDaySaoPauloIso } from './coupon-date';

describe('endOfDaySaoPauloIso', () => {
  it('converts YYYY-MM-DD to UTC ISO at end of SP day', () => {
    expect(endOfDaySaoPauloIso('2026-06-09')).toBe('2026-06-10T02:59:59.000Z');
  });

  it('passes through datetime strings via Date', () => {
    expect(endOfDaySaoPauloIso('2026-06-09T23:59:59-03:00')).toBe('2026-06-10T02:59:59.000Z');
  });
});
