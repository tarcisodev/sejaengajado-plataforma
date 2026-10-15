import { Payment, Reseller } from '../../core/models/domain';
import { periodEnding, rankResellers } from './dashboard-period';

describe('dashboard period', () => {
  const resellers = [
    { id: 'res_a', nome: 'Alfa' } as Reseller,
    { id: 'res_b', nome: 'Beta' } as Reseller,
  ];

  const payments = [
    paid('1', 'res_b', 2_000, '2026-10-01'),
    paid('2', 'res_a', 5_000, '2026-10-10'),
    paid('3', null, 9_000, '2026-10-10'),
    paid('4', 'res_a', 1_000, '2026-09-01'),
    paid('5', 'res_b', 4_000, '2026-10-12', 'PENDING'),
  ];

  it('covers the last 30 civil days ending today', () => {
    expect(periodEnding('2026-10-15', 30)).toEqual({ from: '2026-09-16', to: '2026-10-15' });
    expect(periodEnding('2026-10-15', 7)).toEqual({ from: '2026-10-09', to: '2026-10-15' });
  });

  it('ranks resellers by paid amount and keeps direct sales in the total', () => {
    const ranking = rankResellers(payments, resellers, '2026-10-01', '2026-10-15');

    expect(ranking.total).toBe(16_000);
    expect(ranking.rows).toEqual([
      { id: 'res_a', nome: 'Alfa', valor: 5_000 },
      { id: 'res_b', nome: 'Beta', valor: 2_000 },
    ]);
  });
});

function paid(
  id: string,
  resellerId: string | null,
  valor: number,
  paidAt: string,
  status: Payment['status'] = 'PAID',
): Payment {
  return {
    id,
    orderId: null,
    subscriptionId: null,
    resellerId,
    gateway: 'asaas',
    gatewayPaymentId: id,
    metodo: 'PIX',
    valor,
    status,
    paidAt,
  };
}
