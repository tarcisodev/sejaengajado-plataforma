import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedStockWorld() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'S plan', monthlyFeeCents: 1000 },
  });
  const platform = await adminPrisma.reseller.create({
    data: {
      name: 'PLATAFORMA',
      resellerPlanId: plan.id,
      status: 'ACTIVE',
      isPlatform: true,
    },
  });
  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const product = await adminPrisma.product.create({
    data: {
      code: 'PLAQUE_QR',
      name: 'Placa QR',
      baseWholesaleCents: 800,
    },
  });
  const sitePlanPro = await adminPrisma.plan.create({
    data: {
      code: 'SITE_PRO',
      name: 'Pro',
      type: 'RECURRING',
      priceCents: 1000,
    },
  });
  const sitePlanPronto = await adminPrisma.plan.create({
    data: {
      code: `PRONTO_${randomUUID().slice(0, 8)}`,
      name: 'Pronto',
      type: 'ONE_TIME',
      priceCents: 500,
    },
  });
  const template = await adminPrisma.template.create({
    data: {
      key: `t_${randomUUID().slice(0, 8)}`,
      name: 'T',
      niche: 'generico',
      schemaType: 'LocalBusiness',
    },
  });
  const customerA = await adminPrisma.customer.create({
    data: { resellerId: resellerA.id, name: 'CA' },
  });
  const sitePro = await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: `pro-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: sitePlanPro.id,
      status: 'PUBLISHED',
      editable: true,
    },
  });
  const sitePronto = await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: `pronto-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: sitePlanPronto.id,
      status: 'PUBLISHED',
      editable: false,
    },
  });

  const admin = await insertUser('ADMIN');
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });

  return {
    platform,
    resellerA,
    resellerB,
    product,
    sitePro,
    sitePronto,
    admin,
    userA,
    userB,
  };
}

describe('stock plaques', () => {
  it('locks concurrent OUT, transfers via ledger append, isolates A↔B', async () => {
    const seeded = await seedStockWorld();
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
      await request(app.getHttpServer())
        .post('/api/admin/plaques/movements')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          resellerId: seeded.platform.id,
          type: 'IN',
          plaqueType: 'QR',
          qty: 10,
          unitCostCents: 500,
          reason: 'seed-platform',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/admin/plaques/movements')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          resellerId: seeded.resellerA.id,
          type: 'IN',
          plaqueType: 'QR',
          qty: 10,
          unitCostCents: 700,
          reason: 'seed-a',
        })
        .expect(201);

      const concurrent = await Promise.all(
        Array.from({ length: 20 }, () =>
          request(app.getHttpServer())
            .post('/api/reseller/plaques/movements')
            .set('Authorization', `Bearer ${sessionA.token}`)
            .send({
              type: 'OUT',
              plaqueType: 'QR',
              qty: 1,
              reason: 'GIFT',
              siteId: seeded.sitePro.id,
            }),
        ),
      );
      const ok = concurrent.filter((res) => res.status === 201);
      const insufficient = concurrent.filter(
        (res) => res.status === 409 && res.body.code === 'STOCK_INSUFFICIENT',
      );
      expect(ok).toHaveLength(10);
      expect(insufficient).toHaveLength(10);

      const stockA = await request(app.getHttpServer())
        .get('/api/reseller/plaques/stock')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(stockA.body.items.find((r: { plaqueType: string }) => r.plaqueType === 'QR')?.qty).toBe(
        0,
      );

      await request(app.getHttpServer())
        .post('/api/reseller/plaques/movements')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({
          type: 'OUT',
          plaqueType: 'QR',
          qty: 1,
          reason: 'GIFT',
          siteId: seeded.sitePronto.id,
        })
        .expect(403)
        .expect(({ body }) => {
          expect(body.code).toBe('GIFT_PRO_ONLY');
        });

      // FF4: ASSIGN works on Pronto after restock
      await request(app.getHttpServer())
        .post('/api/admin/plaques/movements')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          resellerId: seeded.resellerA.id,
          type: 'IN',
          plaqueType: 'NFC',
          qty: 2,
          unitCostCents: 800,
        })
        .expect(201);

      const assign = await request(app.getHttpServer())
        .post('/api/reseller/plaques/movements')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('Idempotency-Key', 'assign-plaque-ff4')
        .send({
          type: 'OUT',
          plaqueType: 'NFC',
          qty: 1,
          reason: 'ASSIGN',
          siteId: seeded.sitePronto.id,
        })
        .expect(201);
      expect(assign.body.type).toBe('OUT');
      expect(assign.body.siteId).toBe(seeded.sitePronto.id);
      expect(String(assign.body.reason)).toContain('ASSIGN');

      await request(app.getHttpServer())
        .post('/api/reseller/plaques/movements')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .set('Idempotency-Key', 'assign-cross-tenant')
        .send({
          type: 'OUT',
          plaqueType: 'NFC',
          qty: 1,
          reason: 'ASSIGN',
          siteId: seeded.sitePronto.id,
        })
        .expect(404);

      // Re-seed A for transfer path on B
      await request(app.getHttpServer())
        .post('/api/admin/plaques/movements')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          resellerId: seeded.platform.id,
          type: 'IN',
          plaqueType: 'QR',
          qty: 5,
          unitCostCents: 500,
        })
        .expect(201);

      const transfer = await request(app.getHttpServer())
        .post('/api/admin/plaques/transfer')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'xfer-1')
        .send({
          toResellerId: seeded.resellerB.id,
          plaqueType: 'QR',
          qty: 5,
        })
        .expect(201);

      expect(transfer.body.ledgerEntryId).toBeTruthy();
      expect(transfer.body.resellerIn.qty).toBe(5);

      const ledgerB = await adminPrisma.ledgerEntry.findMany({
        where: { resellerId: seeded.resellerB.id },
      });
      expect(ledgerB).toHaveLength(1);
      expect(ledgerB[0]).toMatchObject({
        type: 'OUT',
        category: 'PLAQUE_PURCHASE',
        amountCents: 4000,
      });

      // Money balance only via append — UPDATE must fail
      await expect(
        adminPrisma.ledgerEntry.update({
          where: { id: ledgerB[0]!.id },
          data: { amountCents: 1 },
        }),
      ).rejects.toThrow();

      const balB = await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(balB.body.balanceCents).toBe(-4000);

      const balA = await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(balA.body.balanceCents).toBe(0);

      const stockB = await request(app.getHttpServer())
        .get('/api/reseller/plaques/stock')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(stockB.body.items.find((r: { plaqueType: string }) => r.plaqueType === 'QR')?.qty).toBe(
        5,
      );

      const stockAAfter = await request(app.getHttpServer())
        .get('/api/reseller/plaques/stock')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(
        stockAAfter.body.items.find((r: { plaqueType: string }) => r.plaqueType === 'QR')?.qty ?? 0,
      ).toBe(0);

      const movesB = await request(app.getHttpServer())
        .get('/api/reseller/plaques/movements')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(movesB.body.items.every((m: { resellerId: string }) => m.resellerId === seeded.resellerB.id)).toBe(
        true,
      );

      const movesA = await request(app.getHttpServer())
        .get('/api/reseller/plaques/movements')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(
        movesA.body.items.every((m: { resellerId: string }) => m.resellerId === seeded.resellerA.id),
      ).toBe(true);
      expect(
        movesA.body.items.some((m: { resellerId: string }) => m.resellerId === seeded.resellerB.id),
      ).toBe(false);

      // Idempotent transfer reuse
      const again = await request(app.getHttpServer())
        .post('/api/admin/plaques/transfer')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'xfer-1')
        .send({
          toResellerId: seeded.resellerB.id,
          plaqueType: 'QR',
          qty: 5,
        })
        .expect(201);
      expect(again.body.reused).toBe(true);
      expect(
        (
          await adminPrisma.ledgerEntry.findMany({
            where: { resellerId: seeded.resellerB.id },
          })
        ).length,
      ).toBe(1);
    } finally {
      await app.close();
    }
  });
});
