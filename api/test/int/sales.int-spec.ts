import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedSalesWorld() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'Sales plan', monthlyFeeCents: 1000 },
  });
  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const plaque = await adminPrisma.product.create({
    data: {
      code: 'PLAQUE_QR',
      name: 'Placa QR',
      baseWholesaleCents: 800,
    },
  });
  const siteProduct = await adminPrisma.product.create({
    data: {
      code: 'SITE_ONE_TIME',
      name: 'Site Pronto',
      baseWholesaleCents: 2000,
    },
  });
  const expensive = await adminPrisma.product.create({
    data: {
      code: 'SITE_PRO',
      name: 'Pro',
      baseWholesaleCents: 5000,
    },
  });

  await adminPrisma.plaqueMovement.create({
    data: {
      resellerId: resellerA.id,
      type: 'IN',
      plaqueType: 'QR',
      qty: 5,
      unitCostCents: 800,
      reason: 'seed',
    },
  });

  const admin = await insertUser('ADMIN');
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });

  return {
    resellerA,
    resellerB,
    plaque,
    siteProduct,
    expensive,
    admin,
    userA,
    userB,
  };
}

describe('sales', () => {
  it('freezes cost/price, idempotency, void, stock rollback, A↔B', async () => {
    const seeded = await seedSalesWorld();
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
      const body = {
        items: [
          {
            productId: seeded.plaque.id,
            qty: 2,
            unitPriceCents: 1500,
          },
          {
            productId: seeded.siteProduct.id,
            qty: 1,
            unitPriceCents: 3500,
          },
          {
            productId: seeded.expensive.id,
            qty: 1,
            unitPriceCents: 1000,
          },
        ],
      };
      // margin = 2*(1500-800) + 1*(3500-2000) + 1*(1000-5000) = 1400 + 1500 - 4000 = -1100

      const created = await request(app.getHttpServer())
        .post('/api/reseller/sales')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('Idempotency-Key', 'sale-1')
        .send(body)
        .expect(201);

      expect(created.body.predictedMarginCents).toBe(-1100);
      expect(created.body.items).toHaveLength(3);

      const bal = await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(bal.body.balanceCents).toBe(2 * 1500 + 3500 + 1000);

      const stock = await request(app.getHttpServer())
        .get('/api/reseller/plaques/stock')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(stock.body.items.find((r: { plaqueType: string }) => r.plaqueType === 'QR')?.qty).toBe(
        3,
      );

      // Change wholesale — frozen cost must stay
      await request(app.getHttpServer())
        .post(`/api/admin/resellers/${seeded.resellerA.id}/wholesale`)
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          productId: seeded.plaque.id,
          priceCents: 100,
          validFrom: new Date().toISOString(),
          validTo: null,
        })
        .expect(201);

      const again = await request(app.getHttpServer())
        .get(`/api/reseller/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      const plaqueItem = again.body.items.find(
        (i: { productId: string }) => i.productId === seeded.plaque.id,
      );
      expect(plaqueItem.unitCostCents).toBe(800);
      expect(again.body.predictedMarginCents).toBe(-1100);

      const idempotent = await request(app.getHttpServer())
        .post('/api/reseller/sales')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('Idempotency-Key', 'sale-1')
        .send(body)
        .expect(201);
      expect(idempotent.body.id).toBe(created.body.id);

      await request(app.getHttpServer())
        .post('/api/reseller/sales')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('Idempotency-Key', 'sale-1')
        .send({
          items: [{ productId: seeded.siteProduct.id, qty: 1, unitPriceCents: 9999 }],
        })
        .expect(409)
        .expect(({ body: err }) => {
          expect(err.code).toBe('IDEMPOTENCY_CONFLICT');
        });

      // Stock insufficient rolls back entire sale
      const beforeCount = await adminPrisma.sale.count({
        where: { resellerId: seeded.resellerA.id },
      });
      await request(app.getHttpServer())
        .post('/api/reseller/sales')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .set('Idempotency-Key', 'sale-fail')
        .send({
          items: [{ productId: seeded.plaque.id, qty: 10, unitPriceCents: 2000 }],
        })
        .expect(409)
        .expect(({ body: err }) => {
          expect(err.code).toBe('STOCK_INSUFFICIENT');
        });
      expect(
        await adminPrisma.sale.count({ where: { resellerId: seeded.resellerA.id } }),
      ).toBe(beforeCount);

      const voided = await request(app.getHttpServer())
        .post(`/api/reseller/sales/${created.body.id}/void`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(201);
      expect(voided.body.status).toBe('VOIDED');

      const balAfter = await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(balAfter.body.balanceCents).toBe(0);

      const stockAfter = await request(app.getHttpServer())
        .get('/api/reseller/plaques/stock')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(
        stockAfter.body.items.find((r: { plaqueType: string }) => r.plaqueType === 'QR')?.qty,
      ).toBe(5);

      await request(app.getHttpServer())
        .post(`/api/reseller/sales/${created.body.id}/void`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(409);

      // A↔B
      await request(app.getHttpServer())
        .get(`/api/reseller/sales/${created.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      const listB = await request(app.getHttpServer())
        .get('/api/reseller/sales')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(listB.body.items).toEqual([]);

      await request(app.getHttpServer())
        .post(`/api/reseller/sales/${created.body.id}/void`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      const ledgerRows = await adminPrisma.ledgerEntry.findMany({
        where: { resellerId: seeded.resellerA.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(ledgerRows.some((row) => row.category === 'SALE' && row.type === 'IN')).toBe(true);
      expect(ledgerRows.some((row) => row.category === 'REVERSAL')).toBe(true);
      await expect(
        adminPrisma.ledgerEntry.update({
          where: { id: ledgerRows[0]!.id },
          data: { amountCents: 1 },
        }),
      ).rejects.toThrow();
    } finally {
      await app.close();
    }
  });
});
