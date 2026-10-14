import { diffCivilDays, toCivilDate } from '../api/plaque-penalty';

export function migrationAvailable(
  status: string,
  delinquentSince: string | null,
  today: Date,
  graceDays: number,
): boolean {
  if (status !== 'DELINQUENT' || !delinquentSince) {
    return false;
  }
  return diffCivilDays(toCivilDate(today), toCivilDate(delinquentSince)) >= graceDays;
}
