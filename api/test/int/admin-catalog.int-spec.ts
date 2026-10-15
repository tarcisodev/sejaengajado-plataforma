import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedAdminCatalog() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  await adminPrisma.platformConfig.create({
    data: {
      id: 'default',
      warningDays: 7,
      readOnlyDays: 8,
      suspendDays: 16,
      archiveDays: 60,
      resellerGraceDays: 30,
      prontoRenewalCents: 12_900,
      plaqueValueCents: 9_900,
      plaquePenaltyPct: 100,
    },
  });

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'Base', monthlyFeeCents: 1000 },
  });
  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const admin = await insertUser('ADMIN');
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });
  return { admin, userA, userB, resellerA, resellerB };
}

describe('admin plans coupons config', () => {
  it('validates config fields, coupon edges, idempotency and blocks resellers A↔B', async () => {
    const seeded = await seedAdminCatalog();
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
      const cfg = await request(app.getHttpServer())
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .expect(200);
      expect(cfg.body.warningDays).toBe(7);
      expect(cfg.body.resellerGraceDays).toBe(30);

      await request(app.getHttpServer())
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'cfg-1')
        .send({
          warningDays: 7,
          readOnlyDays: 8,
          suspendDays: 16,
          archiveDays: 60,
          resellerGraceDays: 15,
          prontoRenewalCents: 12_900,
          plaqueValueCents: 9_900,
          plaquePenaltyPct: 100,
        })
        .expect(400)
        .expect(({ body }) => {
          expect(body.code).toBe('VALIDATION_FAILED');
          expect(body.fields.some((f: { path: string }) => f.path === 'resellerGraceDays')).toBe(
            true,
          );
        });

      await request(app.getHttpServer())
        .put('/api/admin/config')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'cfg-1')
        .send({
          warningDays: 7,
          readOnlyDays: 8,
          suspendDays: 16,
          archiveDays: 60,
          resellerGraceDays: 30,
          prontoRenewalCents: 13_900,
          plaqueValueCents: 9_900,
          plaquePenaltyPct: 50,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.prontoRenewalCents).toBe(13_900);
          expect(body.plaquePenaltyPct).toBe(50);
        });

      const plan = await request(app.getHttpServer())
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'plan-1')
        .send({
          code: 'PRONTO_X',
          name: 'Pronto X',
          type: 'ONE_TIME',
          priceCents: 29900,
        })
        .expect(201);

      const planAgain = await request(app.getHttpServer())
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'plan-1')
        .send({
          code: 'PRONTO_X',
          name: 'Pronto X',
          type: 'ONE_TIME',
          priceCents: 29900,
        })
        .expect(201);
      expect(planAgain.body.id).toBe(plan.body.id);

      await request(app.getHttpServer())
        .post('/api/admin/plans')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'plan-1')
        .send({
          code: 'PRONTO_X',
          name: 'Pronto Y',
          type: 'ONE_TIME',
          priceCents: 1,
        })
        .expect(409)
        .expect(({ body }) => {
          expect(body.code).toBe('IDEMPOTENCY_CONFLICT');
        });

      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'cup-1')
        .send({
          code: 'OFF50',
          type: 'PCT',
          value: 50,
          validFrom: '2026-01-01T00:00:00.000Z',
          validTo: '2026-12-31T23:59:59.000Z',
          maxUses: 10,
        })
        .expect(201);

      const preview = await request(app.getHttpServer())
        .post('/api/admin/coupons/preview')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ code: 'off50', amountCents: 10_000, at: '2026-06-01T12:00:00.000Z' })
        .expect(201);
      expect(preview.body.discountCents).toBe(5000);
      expect(preview.body.finalCents).toBe(5000);

      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ code: 'BIG', type: 'FIXED', value: 999_999 })
        .expect(201);

      const capped = await request(app.getHttpServer())
        .post('/api/admin/coupons/preview')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ code: 'BIG', amountCents: 1500 })
        .expect(201);
      expect(capped.body.finalCents).toBe(0);
      expect(capped.body.discountCents).toBe(1500);

      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ code: 'BADPCT', type: 'PCT', value: 150 })
        .expect(400)
        .expect(({ body }) => {
          expect(body.code).toBe('VALIDATION_FAILED');
          expect(body.fields.some((f: { path: string }) => f.path === 'value')).toBe(true);
        });

      // A↔B: resellers cannot access admin catalog; both get 403
      for (const session of [sessionA, sessionB]) {
        await request(app.getHttpServer())
          .get('/api/admin/config')
          .set('Authorization', `Bearer ${session.token}`)
          .expect(403);
        await request(app.getHttpServer())
          .get('/api/admin/plans')
          .set('Authorization', `Bearer ${session.token}`)
          .expect(403);
        await request(app.getHttpServer())
          .post('/api/admin/coupons')
          .set('Authorization', `Bearer ${session.token}`)
          .send({ code: 'X', type: 'FIXED', value: 1 })
          .expect(403);
      }
    } finally {
      await app.close();
    }
  });
});
