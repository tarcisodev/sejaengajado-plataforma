import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedWholesaleWorld() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'W plan', monthlyFeeCents: 1000 },
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
      baseWholesaleCents: 1500,
    },
  });
  const admin = await insertUser('ADMIN');
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });
  return { product, resellerA, resellerB, admin, userA, userB };
}

describe('wholesale prices', () => {
  it('uses override over base, mid-month swap, and hides other reseller overrides', async () => {
    const seeded = await seedWholesaleWorld();
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
    try {
      const beforeOverride = await request(app.getHttpServer())
        .get('/api/reseller/wholesale')
        .query({ at: '2026-03-01T12:00:00.000Z' })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      const baseRow = beforeOverride.body.items.find(
        (row: { productId: string }) => row.productId === seeded.product.id,
      );
      expect(baseRow.priceCents).toBe(1500);
      expect(baseRow.source).toBe('base');

      await request(app.getHttpServer())
        .post(`/api/admin/resellers/${seeded.resellerA.id}/wholesale`)
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          productId: seeded.product.id,
          priceCents: 1200,
          validFrom: '2026-01-01T03:00:00.000Z',
          validTo: '2026-03-15T03:00:00.000Z',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/admin/resellers/${seeded.resellerA.id}/wholesale`)
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          productId: seeded.product.id,
          priceCents: 900,
          validFrom: '2026-03-15T03:00:00.000Z',
          validTo: null,
        })
        .expect(201);

      const early = await request(app.getHttpServer())
        .get('/api/reseller/wholesale')
        .query({ at: '2026-03-10T15:00:00.000Z' })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(
        early.body.items.find((r: { productId: string }) => r.productId === seeded.product.id)
          .priceCents,
      ).toBe(1200);

      const late = await request(app.getHttpServer())
        .get('/api/reseller/wholesale')
        .query({ at: '2026-03-20T15:00:00.000Z' })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      const lateRow = late.body.items.find(
        (r: { productId: string }) => r.productId === seeded.product.id,
      );
      expect(lateRow.priceCents).toBe(900);
      expect(lateRow.source).toBe('override');
      expect(lateRow.priceCents).toBeLessThan(lateRow.baseWholesaleCents);

      const other = await request(app.getHttpServer())
        .get('/api/reseller/wholesale')
        .query({ at: '2026-03-20T15:00:00.000Z' })
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      const otherRow = other.body.items.find(
        (r: { productId: string }) => r.productId === seeded.product.id,
      );
      expect(otherRow.priceCents).toBe(1500);
      expect(otherRow.source).toBe('base');

      await request(app.getHttpServer())
        .put('/api/reseller/prices')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ productId: seeded.product.id, priceCents: 2990 })
        .expect(200);

      const prices = await request(app.getHttpServer())
        .get('/api/reseller/prices')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(prices.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ productId: seeded.product.id, priceCents: 2990 }),
        ]),
      );

      const pricesB = await request(app.getHttpServer())
        .get('/api/reseller/prices')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(pricesB.body.items).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
