import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { createTenantPrismaProxy } from '../../src/tenant/prisma-tenant.extension';
import { runWithTenantAsync } from '../../src/tenant/tenant.context';
import { TenantScopeMissingError } from '../../src/tenant/tenant.types';
import type { TenantActor } from '../../src/tenant/tenant.types';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

function actor(resellerId: string, userId = randomUUID()): TenantActor {
  return { userId, role: 'RESELLER', resellerId };
}

async function seedPair(): Promise<{
  admin: PrismaClient;
  prisma: PrismaClient;
  resellerA: string;
  resellerB: string;
  productId: string;
  planId: string;
  templateId: string;
  customerA: string;
  customerB: string;
  siteA: string;
  saleA: string;
  ledgerA: string;
}> {
  const { appUrl } = getHarnessPostgres();
  await truncateAll();

  const admin = new PrismaClient({ datasources: { db: { url: appUrl } } });
  const prisma = createTenantPrismaProxy(admin);

  const plan = await admin.resellerPlan.create({
    data: { name: 'Plan', monthlyFeeCents: 1000 },
  });
  const resellerA = await admin.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await admin.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const product = await admin.product.create({
    data: {
      code: 'SITE_PRO',
      name: 'Pro',
      baseWholesaleCents: 100,
    },
  });
  const sitePlan = await admin.plan.create({
    data: {
      code: `P_${randomUUID().slice(0, 8)}`,
      name: 'Plan',
      type: 'ONE_TIME',
      priceCents: 1000,
    },
  });
  const template = await admin.template.create({
    data: {
      key: `t_${randomUUID().slice(0, 8)}`,
      name: 'T',
      niche: 'x',
      schemaType: 'LocalBusiness',
    },
  });
  const customerA = await admin.customer.create({
    data: { resellerId: resellerA.id, name: 'Cust A' },
  });
  const customerB = await admin.customer.create({
    data: { resellerId: resellerB.id, name: 'Cust B' },
  });
  const siteA = await admin.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: `site-a-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: sitePlan.id,
      status: 'DRAFT',
      content: {},
    },
  });
  const saleA = await admin.sale.create({
    data: {
      resellerId: resellerA.id,
      idempotencyKey: randomUUID(),
      status: 'RECORDED',
      items: {
        create: {
          productId: product.id,
          qty: 1,
          unitCostCents: 100,
          unitPriceCents: 200,
        },
      },
    },
  });
  const ledgerA = await admin.ledgerEntry.create({
    data: {
      resellerId: resellerA.id,
      type: 'IN',
      category: 'SALE',
      amountCents: 200,
      refType: 'Sale',
      refId: saleA.id,
    },
  });

  return {
    admin,
    prisma,
    resellerA: resellerA.id,
    resellerB: resellerB.id,
    productId: product.id,
    planId: sitePlan.id,
    templateId: template.id,
    customerA: customerA.id,
    customerB: customerB.id,
    siteA: siteA.id,
    saleA: saleA.id,
    ledgerA: ledgerA.id,
  };
}

describe('tenant fail-closed scope', () => {
  it('throws when a scoped model is queried without tenant context', async () => {
    const { prisma, admin } = await seedPair();
    try {
      expect(() => prisma.customer.findMany()).toThrow(TenantScopeMissingError);
    } finally {
      await admin.$disconnect();
    }
  });

  it('blocks A↔B read, list, edit, publish, sell and void', async () => {
    const ctx = await seedPair();
    const { prisma, admin, resellerA, resellerB, siteA, saleA, productId, customerA, planId, templateId } =
      ctx;
    const actorA = actor(resellerA);
    const actorB = actor(resellerB);

    try {
      const listedB = await runWithTenantAsync(actorB, () => prisma.site.findMany());
      expect(listedB).toEqual([]);

      const readB = await runWithTenantAsync(actorB, () =>
        prisma.site.findUnique({ where: { id: siteA } }),
      );
      expect(readB).toBeNull();

      await expect(
        runWithTenantAsync(actorB, () =>
          prisma.site.update({
            where: { id: siteA },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2025' });

      const published = await runWithTenantAsync(actorA, () =>
        prisma.site.update({
          where: { id: siteA },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        }),
      );
      expect(published.status).toBe('PUBLISHED');

      const forged = await runWithTenantAsync(actorA, () =>
        prisma.customer.create({
          data: {
            name: 'Forged',
            resellerId: resellerB,
          },
        }),
      );
      expect(forged.resellerId).toBe(resellerA);

      const sale = await runWithTenantAsync(actorA, () =>
        prisma.sale.create({
          data: {
            resellerId: resellerB,
            idempotencyKey: randomUUID(),
            status: 'RECORDED',
            items: {
              create: {
                productId,
                qty: 1,
                unitCostCents: 50,
                unitPriceCents: 150,
              },
            },
          },
        }),
      );
      expect(sale.resellerId).toBe(resellerA);

      const salesB = await runWithTenantAsync(actorB, () => prisma.sale.findMany());
      expect(salesB.map((row) => row.id)).not.toContain(sale.id);
      expect(salesB.map((row) => row.id)).not.toContain(saleA);

      await expect(
        runWithTenantAsync(actorB, () =>
          prisma.sale.update({
            where: { id: saleA },
            data: { status: 'VOIDED' },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2025' });

      const voided = await runWithTenantAsync(actorA, () =>
        prisma.sale.update({
          where: { id: saleA },
          data: { status: 'VOIDED' },
        }),
      );
      expect(voided.status).toBe('VOIDED');

      const reversal = await runWithTenantAsync(actorA, () =>
        prisma.ledgerEntry.create({
          data: {
            resellerId: resellerB,
            type: 'OUT',
            category: 'REVERSAL',
            amountCents: 200,
            refType: 'Sale',
            refId: saleA,
            reversalOfId: ctx.ledgerA,
          },
        }),
      );
      expect(reversal.resellerId).toBe(resellerA);

      const ledgersB = await runWithTenantAsync(actorB, () => prisma.ledgerEntry.findMany());
      expect(ledgersB).toEqual([]);

      const siteOwned = await runWithTenantAsync(actorA, () =>
        prisma.site.create({
          data: {
            resellerId: resellerB,
            customerId: customerA,
            slug: `site-a2-${randomUUID().slice(0, 8)}`,
            templateId,
            planId,
            status: 'DRAFT',
            content: {},
          },
        }),
      );
      expect(siteOwned.resellerId).toBe(resellerA);

      const adminRows = await admin.site.findMany({ where: { resellerId: resellerB } });
      expect(adminRows).toHaveLength(0);
    } finally {
      await admin.$disconnect();
    }
  });

  it('keeps adminPrisma unscoped for cross-tenant admin reads', async () => {
    const { admin, prisma, resellerA, resellerB, siteA } = await seedPair();
    try {
      const all = await admin.site.findMany();
      expect(all.map((row) => row.id)).toContain(siteA);
      expect(all.some((row) => row.resellerId === resellerA)).toBe(true);

      const onlyA = await runWithTenantAsync(actor(resellerA), () => prisma.site.findMany());
      expect(onlyA).toHaveLength(1);
      expect(onlyA[0]?.resellerId).toBe(resellerA);

      const onlyB = await runWithTenantAsync(actor(resellerB), () => prisma.site.findMany());
      expect(onlyB).toHaveLength(0);
    } finally {
      await admin.$disconnect();
    }
  });
});
