import { randomUUID } from 'node:crypto';

import { getHarnessPostgres } from '../setup/postgres';

async function seedResellerProduct(): Promise<{
  resellerId: string;
  productId: string;
  planId: string;
  templateId: string;
  customerId: string;
}> {
  const { prisma } = getHarnessPostgres();
  const plan = await prisma.resellerPlan.create({
    data: {
      id: randomUUID(),
      name: 'Plan',
      monthlyFeeCents: 1000,
    },
  });
  const reseller = await prisma.reseller.create({
    data: {
      id: randomUUID(),
      name: 'Res A',
      resellerPlanId: plan.id,
      status: 'ACTIVE',
    },
  });
  const product = await prisma.product.create({
    data: {
      id: randomUUID(),
      code: 'SITE_PRO',
      name: 'Pro',
      baseWholesaleCents: 100,
    },
  });
  const sitePlan = await prisma.plan.create({
    data: {
      id: randomUUID(),
      code: `P_${randomUUID().slice(0, 8)}`,
      name: 'Plan',
      type: 'RECURRING',
      priceCents: 1000,
    },
  });
  const template = await prisma.template.create({
    data: {
      id: randomUUID(),
      key: `t_${randomUUID().slice(0, 8)}`,
      name: 'T',
      niche: 'x',
      schemaType: 'LocalBusiness',
    },
  });
  const customer = await prisma.customer.create({
    data: {
      id: randomUUID(),
      resellerId: reseller.id,
      name: 'Customer',
    },
  });
  return {
    resellerId: reseller.id,
    productId: product.id,
    planId: sitePlan.id,
    templateId: template.id,
    customerId: customer.id,
  };
}

describe('production schema constraints', () => {
  it('rejects UPDATE on ledger entries', async () => {
    const { prisma, adminUrl } = getHarnessPostgres();
    const { resellerId } = await seedResellerProduct();
    const entry = await prisma.ledgerEntry.create({
      data: {
        id: randomUUID(),
        resellerId,
        type: 'IN',
        category: 'MANUAL',
        amountCents: 100,
      },
    });

    const { PrismaClient } = await import('@prisma/client');
    const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    try {
      await expect(
        admin.ledgerEntry.update({
          where: { id: entry.id },
          data: { amountCents: 200 },
        }),
      ).rejects.toThrow(/append-only/);
    } finally {
      await admin.$disconnect();
    }
  });

  it('rejects overlapping wholesale price windows', async () => {
    const { prisma } = getHarnessPostgres();
    const { resellerId, productId } = await seedResellerProduct();
    const from = new Date('2026-01-01T00:00:00.000Z');
    await prisma.wholesalePrice.create({
      data: {
        id: randomUUID(),
        resellerId,
        productId,
        priceCents: 100,
        validFrom: from,
        validTo: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    await expect(
      prisma.wholesalePrice.create({
        data: {
          id: randomUUID(),
          resellerId,
          productId,
          priceCents: 120,
          validFrom: new Date('2026-05-01T00:00:00.000Z'),
          validTo: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects non-positive sale item qty', async () => {
    const { prisma } = getHarnessPostgres();
    const { resellerId, productId } = await seedResellerProduct();
    const sale = await prisma.sale.create({
      data: {
        id: randomUUID(),
        resellerId,
        idempotencyKey: randomUUID(),
        status: 'RECORDED',
      },
    });

    await expect(
      prisma.saleItem.create({
        data: {
          id: randomUUID(),
          saleId: sale.id,
          productId,
          qty: 0,
          unitCostCents: 1,
          unitPriceCents: 2,
        },
      }),
    ).rejects.toThrow();
  });

  it('enforces unique lower(slug) on sites', async () => {
    const { prisma } = getHarnessPostgres();
    const base = await seedResellerProduct();
    await prisma.site.create({
      data: {
        id: randomUUID(),
        resellerId: base.resellerId,
        customerId: base.customerId,
        slug: 'Padaria-Centro',
        templateId: base.templateId,
        planId: base.planId,
        status: 'DRAFT',
        content: {},
      },
    });

    await expect(
      prisma.site.create({
        data: {
          id: randomUUID(),
          resellerId: base.resellerId,
          customerId: base.customerId,
          slug: 'padaria-centro',
          templateId: base.templateId,
          planId: base.planId,
          status: 'DRAFT',
          content: {},
        },
      }),
    ).rejects.toThrow();
  });
});
