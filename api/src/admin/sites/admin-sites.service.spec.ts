import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AdminSitesService } from './admin-sites.service';

describe('AdminSitesService', () => {
  const customerId = '11111111-1111-4111-8111-111111111111';
  const resellerId = '22222222-2222-4222-8222-222222222222';

  function setup() {
    const db = {
      site: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            customerId,
            resellerId,
          },
        ]),
      },
      customer: {
        findUnique: jest.fn(),
      },
    };
    const sites = {
      create: jest.fn().mockResolvedValue({ id: 's-new', customerId, resellerId }),
    };
    const byHostCache = { invalidateSlug: jest.fn() };
    const service = new AdminSitesService(db as never, sites as never, byHostCache as never);
    return { db, sites, service };
  }

  it('lists sites with cursor pagination', async () => {
    const { db, service } = setup();
    const page = await service.list({ limit: 20 });
    expect(db.site.findMany).toHaveBeenCalled();
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('rejects invalid create body', async () => {
    const { service } = setup();
    await expect(service.create({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 when customer missing', async () => {
    const { db, service } = setup();
    db.customer.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        customerId,
        slug: 'loja-demo',
        templateId: '33333333-3333-4333-8333-333333333333',
        planId: '44444444-4444-4444-8444-444444444444',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates create to SitesService under customer reseller tenant', async () => {
    const { db, sites, service } = setup();
    db.customer.findUnique.mockResolvedValue({ id: customerId, resellerId });
    const body = {
      customerId,
      slug: 'loja-demo',
      templateId: '33333333-3333-4333-8333-333333333333',
      planId: '44444444-4444-4444-8444-444444444444',
    };
    const created = await service.create(body);
    expect(sites.create).toHaveBeenCalledWith(resellerId, body);
    expect(created).toMatchObject({ id: 's-new' });
  });
});
