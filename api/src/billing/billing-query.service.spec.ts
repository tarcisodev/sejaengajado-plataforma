import { NotFoundException } from '@nestjs/common';

import { FakeGateway } from '../payments/domain/fake-gateway';
import { runWithTenantAsync } from '../tenant/tenant.context';
import { BillingQueryService } from './billing-query.service';

describe('BillingQueryService', () => {
  const resellerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  function setup() {
    const gateway = new FakeGateway();
    const db = {
      resellerInvoice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      payment: { findFirst: jest.fn() },
      reseller: { findFirst: jest.fn() },
    };
    const service = new BillingQueryService(db as never, gateway);
    return { db, gateway, service };
  }

  it('lists invoices with totalCents from DB (no front calc)', async () => {
    const { db, gateway, service } = setup();
    const charge = await gateway.createCharge({
      gatewayCustomerId: 'c1',
      amountCents: 4990,
      method: 'PIX',
      dueDate: '2026-10-15',
      description: 'inv',
      idempotencyKey: 'k1',
    });
    db.resellerInvoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        period: '2026-09',
        status: 'OPEN',
        totalCents: 4990,
        dueDate: new Date('2026-10-10T00:00:00.000Z'),
        gatewayPaymentId: charge.gatewayPaymentId,
        lines: [
          {
            description: 'Mensalidade',
            qty: 1,
            unitCents: 4990,
            totalCents: 4990,
          },
        ],
      },
    ]);

    const list = await runWithTenantAsync(
      { role: 'RESELLER', userId: 'u1', resellerId },
      () => service.listResellerInvoices(),
    );

    expect(list).toHaveLength(1);
    expect(list[0]!.totalCents).toBe(4990);
    expect(list[0]!.paymentStatus).toBe('PENDING');
    expect(list[0]!.lines[0]!.totalCents).toBe(4990);
  });

  it('polls payment status from gateway', async () => {
    const { db, gateway, service } = setup();
    const charge = await gateway.createCharge({
      gatewayCustomerId: 'c1',
      amountCents: 1200,
      method: 'PIX',
      dueDate: '2026-10-15',
      description: 'pay',
      idempotencyKey: 'k2',
    });
    gateway.markPaid(charge.gatewayPaymentId);
    db.resellerInvoice.findFirst.mockResolvedValue({ id: 'inv-1' });

    const status = await runWithTenantAsync(
      { role: 'RESELLER', userId: 'u1', resellerId },
      () =>
        service.getPaymentStatus(charge.gatewayPaymentId, {
          id: 'u1',
          supabaseId: 'sb',
          email: 'r@example.com',
          role: 'RESELLER',
          resellerId,
          status: 'ACTIVE',
          resellerStatus: 'ACTIVE',
          aal: 'aal1',
        }),
    );

    expect(status.amountCents).toBe(1200);
    expect(status.status).toBe('RECEIVED');
  });

  it('404 when reseller cannot see payment', async () => {
    const { db, service } = setup();
    db.resellerInvoice.findFirst.mockResolvedValue(null);
    db.payment.findFirst.mockResolvedValue(null);

    await expect(
      runWithTenantAsync({ role: 'RESELLER', userId: 'u1', resellerId }, () =>
        service.getPaymentStatus('missing', {
          id: 'u1',
          supabaseId: 'sb',
          email: 'r@example.com',
          role: 'RESELLER',
          resellerId,
          status: 'ACTIVE',
          resellerStatus: 'ACTIVE',
          aal: 'aal1',
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
