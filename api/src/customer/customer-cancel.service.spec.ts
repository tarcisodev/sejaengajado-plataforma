import { CustomerCancelService } from './customer-cancel.service';

describe('CustomerCancelService', () => {
  const siteId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: 'u1',
    email: 'c@example.com',
    role: 'CUSTOMER' as const,
    resellerId: 'r1',
  };

  function setup() {
    const ends = new Date(Date.now() + 90 * 86_400_000);
    const sites = {
      getMine: jest.fn().mockResolvedValue({
        id: siteId,
        slug: 'loja',
        status: 'PUBLISHED',
        resellerId: 'r1',
        plaqueFidelityEndsAt: ends,
      }),
    };
    const db = {
      platformConfig: {
        findUnique: jest.fn().mockResolvedValue({
          plaqueValueCents: 12000,
          plaquePenaltyPct: 100,
        }),
      },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'sub1' }),
      },
      site: {
        update: jest.fn().mockResolvedValue({ id: siteId, slug: 'loja', status: 'ARCHIVED' }),
      },
      lifecycleEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const billing = {
      chargeCancellationPenalty: jest.fn().mockRejectedValue(new Error('not platform')),
    };
    const byHostCache = { invalidateSlug: jest.fn() };
    const service = new CustomerCancelService(
      sites as never,
      db as never,
      billing as never,
      byHostCache as never,
    );
    return { service, db, billing, byHostCache };
  }

  it('quotes penalty from config + fidelity', async () => {
    const { service } = setup();
    const quote = await service.quote(user as never, siteId);
    expect(quote.plaqueValueCentavos).toBe(12000);
    expect(quote.mesesRestantes).toBeGreaterThan(0);
    expect(quote.multaCentavos).toBeGreaterThan(0);
  });

  it('archives site and records lifecycle on cancel', async () => {
    const { service, db, byHostCache } = setup();
    const result = await service.cancel(user as never, siteId);
    expect(db.site.update).toHaveBeenCalled();
    expect(db.lifecycleEvent.create).toHaveBeenCalled();
    expect(byHostCache.invalidateSlug).toHaveBeenCalledWith('loja');
    expect(result.siteId).toBe(siteId);
    expect(result.multaCentavos).toBeGreaterThan(0);
  });
});
