import { spDayStartUtc } from '../common/sao-paulo-time';

/**
 * Day 1 = calendar day after `currentPeriodEnd` in America/Sao_Paulo.
 * Returns 0 if not yet overdue.
 */
export function overdueDaysSp(periodEnd: Date, now: Date): number {
  const endDayStart = spDayStartUtc(periodEnd);
  const day1Start = new Date(endDayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayStart = spDayStartUtc(now);
  if (todayStart.getTime() < day1Start.getTime()) {
    return 0;
  }
  return Math.floor((todayStart.getTime() - day1Start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

export type OverdueTarget = 'WARN' | 'READ_ONLY' | 'SUSPENDED' | 'ARCHIVED' | null;

export function targetStatusForDays(
  days: number,
  cfg: {
    warningDays: number;
    readOnlyDays: number;
    suspendDays: number;
    archiveDays: number;
  },
): OverdueTarget {
  if (days <= 0) {
    return null;
  }
  if (days >= cfg.archiveDays) {
    return 'ARCHIVED';
  }
  if (days >= cfg.suspendDays) {
    return 'SUSPENDED';
  }
  if (days >= cfg.readOnlyDays) {
    return 'READ_ONLY';
  }
  if (days >= 1 && days <= cfg.warningDays) {
    return 'WARN';
  }
  return null;
}
