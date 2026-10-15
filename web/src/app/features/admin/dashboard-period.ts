import { toCivilDate } from '../../core/api/plaque-penalty';
import { Payment, Reseller } from '../../core/models/domain';

export type DashboardPreset = '30' | '7' | 'custom';

export interface ResellerRank {
  id: string;
  nome: string;
  valor: number;
}

export interface PeriodRanking {
  total: number;
  rows: ResellerRank[];
}

export function periodEnding(today: string, days: number): { from: string; to: string } {
  return { from: shiftCivilDate(today, 1 - days), to: today };
}

export function shiftCivilDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rankResellers(
  payments: Payment[],
  resellers: Reseller[],
  from: string,
  to: string,
): PeriodRanking {
  if (!from || !to || from > to) {
    return { total: 0, rows: [] };
  }

  const names = new Map(resellers.map((reseller) => [reseller.id, reseller.nome]));
  const totals = new Map<string, number>();
  let total = 0;

  for (const payment of payments) {
    if (payment.status !== 'PAID' || !payment.paidAt) {
      continue;
    }
    const day = toCivilDate(payment.paidAt);
    if (day < from || day > to) {
      continue;
    }
    total += payment.valor;
    if (!payment.resellerId) {
      continue;
    }
    totals.set(payment.resellerId, (totals.get(payment.resellerId) ?? 0) + payment.valor);
  }

  const rows = [...totals.entries()]
    .map(([id, valor]) => ({ id, nome: names.get(id) ?? id, valor }))
    .sort((left, right) => right.valor - left.valor || left.nome.localeCompare(right.nome, 'pt'));

  return { total, rows };
}
