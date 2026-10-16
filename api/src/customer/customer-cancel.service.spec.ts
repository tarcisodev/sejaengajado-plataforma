import { ConflictException } from '@nestjs/common';

import { cancelIdempotencyKey, CustomerCancelService } from './customer-cancel.service';

describe('CustomerCancelService', () => {
  const siteId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: 'u1',
    email: 'c@example.com',
    role: 'CUSTOMER' as const,
    resellerId: 'r1',
  };

  function setup(status: 'PUBLISHED' | 'ARCHIVED' = 'PUBLISHED') {
    const ends = new Date(Date.now() + 90 * 86_400_000);
    const siteRow = {
      id: siteId,
      slug: 'loja',
      status,
      resellerId: 'r1',
      customerId: 'cust1',
      plaqueFidelityEndsAt: ends,
    };
    const sites = {
      getMine: jest.fn().mockResolvedValue(siteRow),
    };
    const tx = {
      site: {
        findFirst: jest.fn().mockResolvedValue({ ...siteRow }),
        update: jest.fn().mockImplementation(async ({ data }: { data: { status: string } }) => {
          siteRow.status = data.status as 'ARCHIVED';
          return { ...siteRow, ...data };
        }),
      },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'sub1' }),
      },
      lifecycleEvent: { create: jest.fn().mockResolvedValue({}) },
      platformConfig: {
        findUnique: jest.fn().mockResolvedValue({
          plaqueValueCents: 12000,
          plaquePenaltyPct: 100,
        }),
      },
    };
    const db = {
      platformConfig: tx.platformConfig,
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const billing = {
      chargeCancellationPenalty: jest.fn().mockResolvedValue({
        gatewayPaymentId: 'pay_1',
        amountCents: 12000,
        skipped: false,
      }),
    };
    const byHostCache = { invalidateSlug: jest.fn() };
    const service = new CustomerCancelService(
      sites as never,
      db as never,
      billing as never,
      byHostCache as never,
    );
    return { service, db, tx, billing, byHostCache, siteRow };
  }

  it('quotes penalty from config + fidelity', async () => {
    const { service } = setup();
    const quote = await service.quote(user as never, siteId);
    expect(quote.plaqueValueCentavos).toBe(12000);
    expect(quote.mesesRestantes).toBeGreaterThan(0);
    expect(quote.multaCentavos).toBeGreaterThan(0);
  });

  it('archives site once; second cancel is rejected; one penalty charge', async () => {
    const { service, billing, byHostCache, siteRow } = setup('PUBLISHED');
    const first = await service.cancel(user as never, siteId);
    expect(first.multaCentavos).toBeGreaterThan(0);
    expect(billing.chargeCancellationPenalty).toHaveBeenCalledTimes(1);
    expect(billing.chargeCancellationPenalty).toHaveBeenCalledWith(siteId, {
      idempotencyKey: cancelIdempotencyKey(siteId),
    });
    expect(byHostCache.invalidateSlug).toHaveBeenCalledWith('loja');

    siteRow.status = 'ARCHIVED';
    await expect(service.cancel(user as never, siteId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(billing.chargeCancellationPenalty).toHaveBeenCalledTimes(1);
  });

  it('cancelIdempotencyKey is stable per site', () => {
    expect(cancelIdempotencyKey(siteId)).toBe(`cancel:${siteId}`);
  });
});
