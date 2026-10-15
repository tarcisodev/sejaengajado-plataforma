import { NotFoundException } from '@nestjs/common';

import { FakeGateway } from '../payments/domain/fake-gateway';
import { DirectBillingService } from './direct-billing.service';

describe('DirectBillingService', () => {
  const platformId = 'plat-plat-plat-plat-platplatplat';
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';

  function setup() {
    const gateway = new FakeGateway();
    const ledger = { appendForReseller: jest.fn() };
    const db = {
      reseller: {
        findFirst: jest.fn().mockResolvedValue({ id: platformId, isPlatform: true }),
      },
      site: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      plan: {},
      coupon: { findUnique: jest.fn() },
      platformConfig: {
        findUnique: jest.fn().mockResolvedValue({
          prontoRenewalCents: 19900,
          plaqueValueCents: 12000,
          plaquePenaltyPct: 100,
        }),
      },
      order: { create: jest.fn().mockResolvedValue({ id: 'o1', payment: { id: 'p1' }, amountCents: 100 }) },
      subscription: { create: jest.fn() },
      lifecycleEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          subscription: { create: jest.fn().mockResolvedValue({}) },
          site: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    const service = new DirectBillingService(db as never, gateway, ledger as never);
    return { db, gateway, ledger, service };
  }

  it('charges Pronto with Idempotency-Key and cents', async () => {
    const { db, gateway, service } = setup();
    db.site.findUnique.mockResolvedValue({
      id: siteId,
      slug: 'bar',
      resellerId: platformId,
      customerId: 'cust-1',
      planId: 'plan-1',
      plan: { type: 'ONE_TIME', priceCents: 29700, code: 'PRONTO' },
    });

    const result = await service.chargePronto({
      siteId,
      customerName: 'Cliente',
      customerEmail: 'c@example.com',
    });
    expect(result.amountCents).toBe(29700);
    expect(gateway.charges[0]!.idempotencyKey).toMatch(/^direct:pronto:/);
    expect(gateway.charges[0]!.amountCents).toBe(29700);
  });

  it('A↔B: site of another reseller is NOT_FOUND', async () => {
    const { db, service } = setup();
    db.site.findUnique.mockResolvedValue({
      id: otherSiteId,
      resellerId: 'other-reseller',
      plan: { type: 'ONE_TIME', priceCents: 100 },
    });
    await expect(
      service.chargePronto({
        siteId: otherSiteId,
        customerName: 'X',
        customerEmail: 'x@y.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('starts Pro subscription with plaque fidelity', async () => {
    const { db, gateway, service } = setup();
    db.site.findUnique.mockResolvedValue({
      id: siteId,
      slug: 'pro',
      resellerId: platformId,
      customerId: 'cust-1',
      planId: 'plan-pro',
      plan: { type: 'RECURRING', priceCents: 9900, code: 'ENGAJADO_PRO' },
    });
    const result = await service.startProSubscription({
      siteId,
      customerName: 'Pro',
      customerEmail: 'p@example.com',
    });
    expect(result.amountCents).toBe(9900);
    expect(result.gatewaySubscriptionId).toBeTruthy();
    expect(gateway.subscriptions).toHaveLength(1);
  });

  it('renewal uses prontoRenewalCents and stable key', async () => {
    const { db, gateway, service } = setup();
    db.site.findUnique.mockResolvedValue({
      id: siteId,
      slug: 'bar',
      resellerId: platformId,
      customerId: 'cust-1',
      planId: 'plan-1',
      plan: { type: 'ONE_TIME', priceCents: 29700, code: 'PRONTO' },
    });
    const result = await service.chargeProntoRenewal(siteId);
    expect(result.amountCents).toBe(19900);
    expect(gateway.charges[0]!.idempotencyKey).toMatch(/^direct:renewal:/);
  });

  it('cancellation penalty uses stored LifecycleEvent.penaltyCents', async () => {
    const { db, gateway, service } = setup();
    db.site.findUnique.mockResolvedValue({
      id: siteId,
      slug: 'pro',
      resellerId: platformId,
      customerId: 'cust-1',
      planId: 'plan-pro',
      plaqueFidelityEndsAt: new Date('2027-01-01T00:00:00.000Z'),
      plan: { type: 'RECURRING', priceCents: 9900, code: 'ENGAJADO_PRO' },
    });
    db.lifecycleEvent.findFirst.mockResolvedValue({
      id: 'le-1',
      penaltyCents: 4500,
    });
    const result = await service.chargeCancellationPenalty(siteId);
    expect(result.amountCents).toBe(4500);
    expect(gateway.charges[0]!.amountCents).toBe(4500);
  });
});
