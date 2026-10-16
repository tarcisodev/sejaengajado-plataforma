import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AdminSitesService } from './admin-sites.service';

describe('AdminSitesService', () => {
  const customerId = '11111111-1111-4111-8111-111111111111';
  const resellerId = '22222222-2222-4222-8222-222222222222';

  function setup() {
    const siteRow = {
      id: 's1',
      slug: 'loja-demo',
      status: 'DRAFT',
      publishedAt: null as Date | null,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      customerId,
      resellerId,
      content: {
        businessName: 'Loja Demo',
        profile: { nome: 'Loja Demo', cidade: 'Uberaba', uf: 'MG' },
        theme: { niche: 'generico' },
      },
    };
    const db = {
      site: {
        findMany: jest.fn().mockResolvedValue([siteRow]),
        findUnique: jest.fn().mockResolvedValue(siteRow),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...siteRow,
            ...data,
            slug: (data['slug'] as string) ?? siteRow.slug,
            status: (data['status'] as string) ?? siteRow.status,
            content: data['content'] ?? siteRow.content,
          }),
        ),
      },
      customer: {
        findUnique: jest.fn(),
      },
      plan: {
        findUnique: jest.fn().mockResolvedValue({ id: '44444444-4444-4444-8444-444444444444' }),
      },
      reservedSlug: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      reseller: {
        findUnique: jest.fn(),
      },
    };
    const sites = {
      create: jest.fn().mockResolvedValue({ id: 's-new', customerId, resellerId }),
    };
    const byHostCache = { invalidateSlug: jest.fn() };
    const service = new AdminSitesService(db as never, sites as never, byHostCache as never);
    return { db, sites, service, byHostCache, siteRow };
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

  it('publishes a draft and invalidates by-host cache (bug 0.e)', async () => {
    const { service, byHostCache, db } = setup();
    const published = await service.publish('s1');
    expect(db.site.update).toHaveBeenCalled();
    expect(published.status).toBe('PUBLISHED');
    expect(byHostCache.invalidateSlug).toHaveBeenCalledWith('loja-demo');
  });

  it('patches content with zod validation', async () => {
    const { service, byHostCache } = setup();
    const updated = await service.updateContent('s1', {
      content: {
        businessName: 'Padaria Nova',
        profile: { nome: 'Padaria Nova', cidade: 'Uberaba', uf: 'MG' },
        theme: { niche: 'restaurante' },
      },
    });
    expect(updated.content).toMatchObject({ theme: { niche: 'restaurante' } });
    expect(byHostCache.invalidateSlug).toHaveBeenCalledWith('loja-demo');
  });

  it('patches advanced meta (slug + status) and invalidates both hosts', async () => {
    const { service, byHostCache } = setup();
    const updated = await service.patchMeta('s1', {
      slug: 'loja-nova',
      status: 'PUBLISHED',
      planId: '44444444-4444-4444-8444-444444444444',
    });
    expect(updated.slug).toBe('loja-nova');
    expect(updated.status).toBe('PUBLISHED');
    expect(byHostCache.invalidateSlug).toHaveBeenCalledWith('loja-demo');
    expect(byHostCache.invalidateSlug).toHaveBeenCalledWith('loja-nova');
  });
});
