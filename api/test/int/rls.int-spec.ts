import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { createTenantPrismaProxy } from '../../src/tenant/prisma-tenant.extension';
import { runWithTenantAsync } from '../../src/tenant/tenant.context';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';
import { PRISMA } from '../../src/tenant/prisma.module';
import request from 'supertest';

async function seedSites(): Promise<{
  resellerA: string;
  resellerB: string;
  siteA: string;
  siteB: string;
  customerA: string;
}> {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'RLS plan', monthlyFeeCents: 1 },
  });
  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const sitePlan = await adminPrisma.plan.create({
    data: {
      code: `P_${randomUUID().slice(0, 8)}`,
      name: 'Plan',
      type: 'ONE_TIME',
      priceCents: 1000,
    },
  });
  const template = await adminPrisma.template.create({
    data: {
      key: `t_${randomUUID().slice(0, 8)}`,
      name: 'T',
      niche: 'x',
      schemaType: 'LocalBusiness',
    },
  });
  const customerA = await adminPrisma.customer.create({
    data: { resellerId: resellerA.id, name: 'Cust A' },
  });
  const customerB = await adminPrisma.customer.create({
    data: { resellerId: resellerB.id, name: 'Cust B' },
  });
  const siteA = await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: `a-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: sitePlan.id,
      status: 'DRAFT',
      content: {},
    },
  });
  const siteB = await adminPrisma.site.create({
    data: {
      resellerId: resellerB.id,
      customerId: customerB.id,
      slug: `b-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: sitePlan.id,
      status: 'DRAFT',
      content: {},
    },
  });

  return {
    resellerA: resellerA.id,
    resellerB: resellerB.id,
    siteA: siteA.id,
    siteB: siteB.id,
    customerA: customerA.id,
  };
}

describe('row level security (se_app)', () => {
  it('returns zero rows without app.reseller_id and never leaks B to A via raw SQL', async () => {
    const { prisma } = getHarnessPostgres();
    const { resellerA, siteA, siteB } = await seedSites();

    const withoutTenant = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM sites ORDER BY id
    `;
    expect(withoutTenant).toEqual([]);

    const onlyA = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.reseller_id', ${resellerA}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM sites ORDER BY id`;
    });
    expect(onlyA.map((row) => row.id)).toEqual([siteA]);
    expect(onlyA.map((row) => row.id)).not.toContain(siteB);
  });

  it('blocks cross-tenant SELECT, INSERT and UPDATE via RLS even without the Prisma guard', async () => {
    const { prisma } = getHarnessPostgres();
    const { resellerA, resellerB, siteA, siteB, customerA } = await seedSites();
    const { adminPrisma } = getHarnessPostgres();
    const template = await adminPrisma.template.findFirstOrThrow();
    const plan = await adminPrisma.plan.findFirstOrThrow();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.reseller_id', ${resellerA}, true)`;
      const rows = await tx.site.findMany();
      expect(rows.map((row) => row.id)).toEqual([siteA]);
      expect(rows.map((row) => row.id)).not.toContain(siteB);

      await expect(
        tx.site.update({
          where: { id: siteB },
          data: { status: 'PUBLISHED' },
        }),
      ).rejects.toThrow();

      await expect(
        tx.site.create({
          data: {
            resellerId: resellerB,
            customerId: customerA,
            slug: `leak-${randomUUID().slice(0, 8)}`,
            templateId: template.id,
            planId: plan.id,
            status: 'DRAFT',
            content: {},
          },
        }),
      ).rejects.toThrow();
    });

    const stillDraft = await adminPrisma.site.findUniqueOrThrow({ where: { id: siteB } });
    expect(stillDraft.status).toBe('DRAFT');
  });

  it('uses SupabaseJwtGuard DB role/resellerId for tenant-scoped Prisma reads', async () => {
    const { resellerA, resellerB, siteA } = await seedSites();
    const userA = await insertUser('RESELLER', { resellerId: resellerA });
    const session = loginAs('RESELLER', {
      supabaseId: userA.supabaseId,
      resellerId: resellerB, // forged claim — must be ignored
    });

    const { app } = await createTestApp();
    try {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.resellerId).toBe(resellerA);
        });

      const prisma = app.get(PRISMA) as PrismaClient;
      const sites = await runWithTenantAsync(
        { userId: userA.id, role: 'RESELLER', resellerId: resellerA },
        () => prisma.site.findMany(),
      );
      expect(sites.map((row) => row.id)).toEqual([siteA]);
    } finally {
      await app.close();
    }
  });

  it('keeps fail-closed Prisma scope: no tenant context throws', async () => {
    const { appUrl } = getHarnessPostgres();
    await seedSites();
    const root = new PrismaClient({ datasources: { db: { url: appUrl } } });
    const prisma = createTenantPrismaProxy(root);
    try {
      expect(() => prisma.site.findMany()).toThrow(/Tenant scope missing/);
    } finally {
      await root.$disconnect();
    }
  });
});
