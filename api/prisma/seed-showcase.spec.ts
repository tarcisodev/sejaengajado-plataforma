import {
  SHOWCASE_CUSTOMER_EMAIL,
  SHOWCASE_CUSTOMER_ID,
  SHOWCASE_CUSTOMER_NAME,
  runShowcaseSeed,
} from './seed-showcase';
import { assertDemoSeedAllowed, isProdSejaengajadoDatabase } from './demo-seed-guard';

describe('demo-seed-guard', () => {
  it('detects production database name sejaengajado', () => {
    expect(
      isProdSejaengajadoDatabase('postgresql://u:p@db.internal:5432/sejaengajado?schema=public'),
    ).toBe(true);
    expect(isProdSejaengajadoDatabase('postgresql://u:p@localhost:5432/sejaengajado_dev')).toBe(
      false,
    );
  });

  it('aborts seed-demo in production without ALLOW_DEMO_SEED', () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://x/dev' }),
    ).toThrow(/NODE_ENV=production/);
  });

  it('aborts seed-demo when DATABASE_URL is prod sejaengajado', () => {
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://u:p@host/sejaengajado',
      }),
    ).toThrow(/banco sejaengajado/);
  });

  it('allows with ALLOW_DEMO_SEED=1', () => {
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@host/sejaengajado',
        ALLOW_DEMO_SEED: '1',
      }),
    ).not.toThrow();
  });
});

describe('runShowcaseSeed', () => {
  function mockDb(overrides: Record<string, unknown> = {}) {
    const platform = {
      id: 'platform-1',
      isPlatform: true,
      createdAt: new Date('2020-01-01'),
    };
    const plan = { id: 'plan-pronto', code: 'PRONTO', priceCents: 29_900 };
    const calls = {
      platformConfig: 0,
      product: 0,
      planUpsert: 0,
      planCreate: 0,
      planUpdate: 0,
      resellerPlan: 0,
      user: 0,
      templateUpdate: 0,
      siteUpdate: 0,
    };

    const templates = new Map<string, { id: string; key: string }>();
    const sites = new Map<
      string,
      { id: string; slug: string; isDemo: boolean; content?: unknown }
    >();
    let customer: {
      id: string;
      resellerId: string;
      name: string;
      email: string | null;
    } | null = null;

    const db = {
      reseller: {
        findFirst: jest.fn(async () => platform),
      },
      plan: {
        findUnique: jest.fn(async () => plan),
        findFirst: jest.fn(async () => plan),
        create: jest.fn(async () => {
          calls.planCreate += 1;
          throw new Error('must not create plan');
        }),
        update: jest.fn(async () => {
          calls.planUpdate += 1;
          throw new Error('must not update plan');
        }),
        upsert: jest.fn(async () => {
          calls.planUpsert += 1;
          throw new Error('must not upsert plan');
        }),
      },
      template: {
        findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
          templates.get(where.key) ?? null,
        ),
        create: jest.fn(
          async ({ data }: { data: { key: string; name: string } }) => {
            const row = { id: `tpl-${data.key}`, key: data.key, name: data.name };
            templates.set(data.key, row);
            return row;
          },
        ),
        update: jest.fn(async () => {
          calls.templateUpdate += 1;
          throw new Error('must not update template');
        }),
      },
      customer: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          customer?.id === where.id ? customer : null,
        ),
        findFirst: jest.fn(async () => customer),
        create: jest.fn(
          async ({
            data,
          }: {
            data: {
              id: string;
              resellerId: string;
              name: string;
              email: string;
            };
          }) => {
            customer = {
              id: data.id,
              resellerId: data.resellerId,
              name: data.name,
              email: data.email,
            };
            return customer;
          },
        ),
        update: jest.fn(async () => {
          throw new Error('must not update customer');
        }),
      },
      site: {
        findFirst: jest.fn(async ({ where }: { where: { slug: string } }) =>
          sites.get(where.slug) ?? null,
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: { slug: string; isDemo: boolean; planId: string; content?: unknown };
          }) => {
            expect(data.isDemo).toBe(true);
            expect(data.planId).toBe(plan.id);
            const row = {
              id: `site-${data.slug}`,
              slug: data.slug,
              isDemo: data.isDemo,
              content: data.content,
            };
            sites.set(data.slug, row);
            return row;
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { isDemo?: boolean; content?: unknown };
          }) => {
            calls.siteUpdate += 1;
            const site = Array.from(sites.values()).find((s) => s.id === where.id);
            if (site && !site.isDemo) {
              throw new Error('must not update real site');
            }
            if (site) {
              Object.assign(site, data);
              return site;
            }
            return { id: where.id, ...data };
          },
        ),
      },
      plaque: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: { siteId: string } }) => data),
      },
      // Forbidden surfaces — if seed ever gains these, tests fail loud.
      platformConfig: {
        upsert: jest.fn(async () => {
          calls.platformConfig += 1;
        }),
      },
      product: {
        upsert: jest.fn(async () => {
          calls.product += 1;
        }),
      },
      user: {
        upsert: jest.fn(async () => {
          calls.user += 1;
        }),
      },
      resellerPlan: {
        upsert: jest.fn(async () => {
          calls.resellerPlan += 1;
        }),
      },
      ...overrides,
    };

    return { db, calls, templates, sites, setCustomer: (c: typeof customer) => { customer = c; } };
  }

  it('aborts when isPlatform reseller is missing', async () => {
    const { db } = mockDb();
    (db.reseller.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(runShowcaseSeed(db as never)).rejects.toThrow(/isPlatform/);
  });

  it('creates showcase sites once and is idempotent on second run', async () => {
    const { db, calls } = mockDb();

    const first = await runShowcaseSeed(db as never);
    expect(first.created.sites).toEqual([
      'demo-forno',
      'demo-barbearia',
      'demo-estudio',
    ]);
    expect(first.created.customer).toBe(true);
    expect(first.created.templates).toEqual(
      expect.arrayContaining(['restaurante', 'barbearia', 'loja-local']),
    );

    const second = await runShowcaseSeed(db as never);
    expect(second.created.sites).toEqual([]);
    expect(second.created.customer).toBe(false);
    expect(second.created.templates).toEqual([]);
    expect(second.skipped.sites).toEqual([
      'demo-forno',
      'demo-barbearia',
      'demo-estudio',
    ]);
    expect(second.skipped.templates).toEqual(
      expect.arrayContaining(['restaurante', 'barbearia', 'loja-local']),
    );

    expect(calls.siteUpdate).toBe(3);
    expect(calls.templateUpdate).toBe(0);
    expect(calls.planCreate + calls.planUpdate + calls.planUpsert).toBe(0);
    expect(calls.platformConfig + calls.product + calls.user + calls.resellerPlan).toBe(0);
    expect(db.plan.findUnique).toHaveBeenCalled();
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: SHOWCASE_CUSTOMER_ID,
          name: SHOWCASE_CUSTOMER_NAME,
          email: SHOWCASE_CUSTOMER_EMAIL,
          resellerId: 'platform-1',
        }),
      }),
    );
  });

  it('does not alter an existing customer or real site content', async () => {
    const { db, setCustomer } = mockDb();
    setCustomer({
      id: SHOWCASE_CUSTOMER_ID,
      resellerId: 'platform-1',
      name: 'Nome antigo que não deve mudar',
      email: SHOWCASE_CUSTOMER_EMAIL,
    });
    (db.site.findFirst as jest.Mock).mockImplementation(
      async ({ where }: { where: { slug: string } }) => ({
        id: `existing-${where.slug}`,
        slug: where.slug,
        isDemo: false,
        content: { businessName: 'CONTEUDO_ORIGINAL' },
      }),
    );

    const result = await runShowcaseSeed(db as never);
    expect(result.created.customer).toBe(false);
    expect(result.created.sites).toEqual([]);
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.site.create).not.toHaveBeenCalled();
    expect(db.site.update).not.toHaveBeenCalled();
  });

  it('updates demo sites when existing site is isDemo=true', async () => {
    const { db, sites, calls } = mockDb();
    sites.set('demo-forno', {
      id: 'existing-demo-forno',
      slug: 'demo-forno',
      isDemo: true,
      content: { businessName: 'OLD_DEMO' },
    });

    await runShowcaseSeed(db as never);
    expect(calls.siteUpdate).toBe(1);
    expect(db.site.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-demo-forno' },
        data: expect.objectContaining({
          isDemo: true,
          content: expect.any(Object),
        }),
      }),
    );
  });
});
