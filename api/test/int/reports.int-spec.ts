import request from 'supertest';

import { explainHasSeqScan } from '../../src/reports/reports.service';
import { spMonthRangeUtc } from '../../src/common/sao-paulo-time';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedReportsWorld() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'R plan', monthlyFeeCents: 1000 },
  });
  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });

  const sitePlan = await adminPrisma.plan.create({
    data: {
      code: 'SITE_PRO',
      name: 'Pro',
      type: 'RECURRING',
      priceCents: 1000,
    },
  });
  const template = await adminPrisma.template.create({
    data: {
      key: 't_reports',
      name: 'T',
      niche: 'generico',
      schemaType: 'LocalBusiness',
    },
  });
  const customerA = await adminPrisma.customer.create({
    data: { resellerId: resellerA.id, name: 'CA' },
  });
  await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: 'dash-a',
      templateId: template.id,
      planId: sitePlan.id,
      status: 'PUBLISHED',
      editable: true,
    },
  });
  await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: 'dash-a2',
      templateId: template.id,
      planId: sitePlan.id,
      status: 'READ_ONLY',
      editable: false,
    },
  });
  await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: 'dash-draft',
      templateId: template.id,
      planId: sitePlan.id,
      status: 'DRAFT',
      editable: true,
    },
  });

  const product = await adminPrisma.product.create({
    data: {
      code: 'SITE_ONE_TIME',
      name: 'Site',
      baseWholesaleCents: 2000,
    },
  });

  // Sale in current SP month: cost 2000, price 5000 → predicted margin 3000
  const now = new Date();
  const sale = await adminPrisma.sale.create({
    data: {
      resellerId: resellerA.id,
      status: 'RECORDED',
      idempotencyKey: 'dash-sale-1',
      createdAt: now,
      items: {
        create: [
          {
            productId: product.id,
            qty: 1,
            unitCostCents: 2000,
            unitPriceCents: 5000,
          },
        ],
      },
    },
  });
  await adminPrisma.ledgerEntry.create({
    data: {
      resellerId: resellerA.id,
      type: 'IN',
      category: 'SALE',
      amountCents: 5000,
      refType: 'Sale',
      refId: sale.id,
      createdAt: now,
    },
  });
  // Paid platform invoice OUT 1500 → realized = 5000 - 1500 = 3500
  await adminPrisma.ledgerEntry.create({
    data: {
      resellerId: resellerA.id,
      type: 'OUT',
      category: 'PLATFORM_INVOICE',
      amountCents: 1500,
      refType: 'ResellerInvoice',
      refId: randomRef(),
      createdAt: now,
    },
  });
  await adminPrisma.plaqueMovement.create({
    data: {
      resellerId: resellerA.id,
      type: 'IN',
      plaqueType: 'QR',
      qty: 7,
      unitCostCents: 800,
      reason: 'seed',
    },
  });
  const openInvoice = await adminPrisma.resellerInvoice.create({
    data: {
      resellerId: resellerA.id,
      period: '2026-03',
      status: 'OPEN',
      totalCents: 9900,
    },
  });

  // Noise for B
  await adminPrisma.sale.create({
    data: {
      resellerId: resellerB.id,
      status: 'RECORDED',
      idempotencyKey: 'dash-sale-b',
      createdAt: now,
      items: {
        create: [
          {
            productId: product.id,
            qty: 9,
            unitCostCents: 100,
            unitPriceCents: 9999,
          },
        ],
      },
    },
  });

  const admin = await insertUser('ADMIN');
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });

  return {
    resellerA,
    resellerB,
    openInvoice,
    admin,
    userA,
    userB,
    now,
  };
}

function randomRef(): string {
  return '00000000-0000-4000-8000-000000000099';
}

describe('reseller dashboard and reports', () => {
  it('returns known totals, isolates A↔B, and avoids seq scan on sales/ledger', async () => {
    const seeded = await seedReportsWorld();
    const adminSession = loginAs('ADMIN', {
      supabaseId: seeded.admin.supabaseId,
      aal: 'aal2',
    });
    const sessionA = loginAs('RESELLER', {
      supabaseId: seeded.userA.supabaseId,
      resellerId: seeded.resellerA.id,
    });
    const sessionB = loginAs('RESELLER', {
      supabaseId: seeded.userB.supabaseId,
      resellerId: seeded.resellerB.id,
    });

    const { app } = await createTestApp();
    const { adminPrisma } = getHarnessPostgres();
    try {
      const dash = await request(app.getHttpServer())
        .get('/api/reseller/dashboard')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);

      expect(dash.body.activeSites).toBe(2);
      expect(dash.body.monthSalesCents).toBe(5000);
      expect(dash.body.predictedMarginCents).toBe(3000);
      expect(dash.body.realizedMarginCents).toBe(3500);
      expect(dash.body.balanceCents).toBe(3500);
      expect(dash.body.stock).toEqual(
        expect.arrayContaining([expect.objectContaining({ plaqueType: 'QR', qty: 7 })]),
      );
      expect(dash.body.openInvoice).toMatchObject({
        id: seeded.openInvoice.id,
        period: '2026-03',
        totalCents: 9900,
        status: 'OPEN',
      });

      const report = await request(app.getHttpServer())
        .get('/api/reseller/reports/sales')
        .query({
          from: new Date(seeded.now.getTime() - 60_000).toISOString(),
          to: new Date(seeded.now.getTime() + 60_000).toISOString(),
        })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);

      expect(report.body.costCents).toBe(2000);
      expect(report.body.chargedCents).toBe(5000);
      expect(report.body.predictedMarginCents).toBe(3000);
      expect(report.body.realizedMarginCents).toBe(3500);
      expect(report.body.salesCount).toBe(1);
      expect(report.body.items).toHaveLength(1);
      expect(report.body.nextCursor).toBeNull();

      // A↔B + admin (antes de criar vendas extras de paginação)
      const dashB = await request(app.getHttpServer())
        .get('/api/reseller/dashboard')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(dashB.body.monthSalesCents).toBe(9 * 9999);
      expect(dashB.body.activeSites).toBe(0);

      await request(app.getHttpServer())
        .get(`/api/admin/resellers/${seeded.resellerA.id}/dashboard`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(403);

      const adminDash = await request(app.getHttpServer())
        .get(`/api/admin/resellers/${seeded.resellerA.id}/dashboard`)
        .set('Authorization', `Bearer ${adminSession.token}`)
        .expect(200);
      expect(adminDash.body.monthSalesCents).toBe(5000);

      await request(app.getHttpServer())
        .get(`/api/admin/resellers/${seeded.resellerA.id}/dashboard`)
        .set(
          'Authorization',
          `Bearer ${loginAs('ADMIN', { supabaseId: seeded.admin.supabaseId, aal: 'aal1' }).token}`,
        )
        .expect(403);

      // Intervalo > 366 dias → 400
      await request(app.getHttpServer())
        .get('/api/reseller/reports/sales')
        .query({
          from: '2024-01-01T00:00:00.000Z',
          to: '2026-01-10T00:00:00.000Z',
        })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body.code).toBe('VALIDATION_FAILED');
          expect(body.fields.some((f: { path: string }) => f.path === 'to')).toBe(true);
        });

      // Paginação: create extra sales then limit=1
      const productId = (
        await adminPrisma.product.findFirstOrThrow({ where: { code: 'SITE_ONE_TIME' } })
      ).id;
      for (let i = 0; i < 3; i += 1) {
        await adminPrisma.sale.create({
          data: {
            resellerId: seeded.resellerA.id,
            status: 'RECORDED',
            idempotencyKey: `page-${i}`,
            createdAt: new Date(seeded.now.getTime() + (i + 1) * 1000),
            items: {
              create: [
                {
                  productId,
                  qty: 1,
                  unitCostCents: 100,
                  unitPriceCents: 200,
                },
              ],
            },
          },
        });
      }
      const page1 = await request(app.getHttpServer())
        .get('/api/reseller/reports/sales')
        .query({
          from: new Date(seeded.now.getTime() - 60_000).toISOString(),
          to: new Date(seeded.now.getTime() + 60_000).toISOString(),
          limit: '1',
        })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(page1.body.items).toHaveLength(1);
      expect(page1.body.nextCursor).toBeTruthy();
      expect(page1.body.salesCount).toBe(4);

      const page2 = await request(app.getHttpServer())
        .get('/api/reseller/reports/sales')
        .query({
          from: new Date(seeded.now.getTime() - 60_000).toISOString(),
          to: new Date(seeded.now.getTime() + 60_000).toISOString(),
          limit: '10',
          cursor: page1.body.nextCursor,
        })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(page2.body.items.length).toBeGreaterThanOrEqual(1);
      expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);

      const { from, toExclusive } = spMonthRangeUtc(seeded.now);
      // Force index path (small tables otherwise prefer Seq Scan).
      await adminPrisma.$executeRaw`SET enable_seqscan = off`;
      try {
        const salesPlan = await adminPrisma.$queryRaw<{ 'QUERY PLAN': unknown }[]>`
          EXPLAIN (FORMAT JSON)
          SELECT id FROM sales
          WHERE reseller_id = ${seeded.resellerA.id}::uuid
            AND created_at >= ${from}
            AND created_at < ${toExclusive}
        `;
        const ledgerPlan = await adminPrisma.$queryRaw<{ 'QUERY PLAN': unknown }[]>`
          EXPLAIN (FORMAT JSON)
          SELECT id FROM ledger_entries
          WHERE reseller_id = ${seeded.resellerA.id}::uuid
            AND created_at >= ${from}
            AND created_at < ${toExclusive}
        `;
        expect(explainHasSeqScan(salesPlan, 'sales')).toBe(false);
        expect(explainHasSeqScan(ledgerPlan, 'ledger_entries')).toBe(false);
        expect(JSON.stringify(salesPlan)).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan/);
        expect(JSON.stringify(ledgerPlan)).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan/);
      } finally {
        await adminPrisma.$executeRaw`SET enable_seqscan = on`;
      }
    } finally {
      await app.close();
    }
  });
});
