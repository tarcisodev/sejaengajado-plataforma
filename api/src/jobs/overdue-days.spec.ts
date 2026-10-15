import { overdueDaysSp, targetStatusForDays } from './overdue-days';

describe('overdueDaysSp', () => {
  it('day 1 is the SP calendar day after period end', () => {
    // period ends 2026-03-10 (any time) → day 1 = 2026-03-11 SP
    const periodEnd = new Date('2026-03-10T18:00:00.000Z');
    expect(overdueDaysSp(periodEnd, new Date('2026-03-10T20:00:00.000Z'))).toBe(0);
    // 2026-03-11 12:00 SP = 15:00 UTC
    expect(overdueDaysSp(periodEnd, new Date('2026-03-11T15:00:00.000Z'))).toBe(1);
    expect(overdueDaysSp(periodEnd, new Date('2026-03-17T15:00:00.000Z'))).toBe(7);
    expect(overdueDaysSp(periodEnd, new Date('2026-03-18T15:00:00.000Z'))).toBe(8);
  });

  it('handles SP day rollover around midnight', () => {
    const periodEnd = new Date('2026-06-01T02:30:00.000Z'); // still 2026-05-31 in SP
    // 2026-06-01 02:00 UTC = 2026-05-31 23:00 SP → day 0 relative to May 31 end day → day1 is June 1 SP
    expect(overdueDaysSp(periodEnd, new Date('2026-06-01T02:00:00.000Z'))).toBe(0);
    // 2026-06-01 03:00 UTC = 2026-06-01 00:00 SP → day 1
    expect(overdueDaysSp(periodEnd, new Date('2026-06-01T03:00:00.000Z'))).toBe(1);
  });
});

describe('targetStatusForDays', () => {
  const cfg = {
    warningDays: 7,
    readOnlyDays: 8,
    suspendDays: 16,
    archiveDays: 60,
  };

  it('maps each band', () => {
    expect(targetStatusForDays(0, cfg)).toBeNull();
    expect(targetStatusForDays(1, cfg)).toBe('WARN');
    expect(targetStatusForDays(7, cfg)).toBe('WARN');
    expect(targetStatusForDays(8, cfg)).toBe('READ_ONLY');
    expect(targetStatusForDays(16, cfg)).toBe('SUSPENDED');
    expect(targetStatusForDays(60, cfg)).toBe('ARCHIVED');
  });
});
