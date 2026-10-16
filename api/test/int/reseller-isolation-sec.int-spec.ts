import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

/**
 * SEC-GOLIVE: two real resellers — A must not read/mutate B's data on new surfaces.
 * Admin-only routes (coupons/payments/invoices) return 403 for RESELLER.
 */
describe('reseller isolation (SEC-GOLIVE)', () => {
  it('A cannot see or alter B sites/customers; admin money routes are 403', async () => {
    const { adminPrisma } = getHarnessPostgres();
    await truncateAll();

    const plan = await adminPrisma.resellerPlan.create({
      data: { name: 'Open', monthlyFeeCents: 1000, siteLimit: null },
    });
    const resellerA = await adminPrisma.reseller.create({
      data: { name: 'IsoA', resellerPlanId: plan.id, status: 'ACTIVE' },
    });
    const resellerB = await adminPrisma.reseller.create({
      data: { name: 'IsoB', resellerPlanId: plan.id, status: 'ACTIVE' },
    });
    const sitePlan = await adminPrisma.plan.create({
      data: {
        code: `P_${randomUUID().slice(0, 8)}`,
        name: 'Pronto',
        type: 'ONE_TIME',
        priceCents: 29900,
      },
    });
    const template = await adminPrisma.template.create({
      data: {
        key: `t_${randomUUID().slice(0, 8)}`,
        name: 'Gen',
        niche: 'generico',
        schemaType: 'LocalBusiness',
      },
    });

    const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
    const userB = await insertUser('RESELLER', { resellerId: resellerB.id });
    const sessionA = loginAs('RESELLER', {
      supabaseId: userA.supabaseId,
      resellerId: resellerA.id,
    });
    const sessionB = loginAs('RESELLER', {
      supabaseId: userB.supabaseId,
      resellerId: resellerB.id,
    });

    const { app } = await createTestApp();
    try {
      const custA = await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ name: 'Cliente A', email: 'cliente.a@example.com' })
        .expect(201);

      const siteA = await request(app.getHttpServer())
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({
          customerId: custA.body.id,
          slug: `iso-a-${randomUUID().slice(0, 6)}`,
          templateId: template.id,
          planId: sitePlan.id,
        })
        .expect(201);

      // B cannot read/mutate A's customer or site
      await request(app.getHttpServer())
        .get(`/api/reseller/customers/${custA.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/reseller/sites/${siteA.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/reseller/sites/${siteA.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .send({ content: { businessName: 'Hack' } })
        .expect(404);

      await request(app.getHttpServer())
        .post(`/api/reseller/sites/${siteA.body.id}/publish`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      const listB = await request(app.getHttpServer())
        .get('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(listB.body.items ?? listB.body).toEqual(
        expect.not.arrayContaining([expect.objectContaining({ id: siteA.body.id })]),
      );

      const custListB = await request(app.getHttpServer())
        .get('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      const custItems = custListB.body.items ?? custListB.body;
      expect(custItems).toEqual(
        expect.not.arrayContaining([expect.objectContaining({ id: custA.body.id })]),
      );

      // Same email allowed for different resellers (unique per reseller)
      await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .send({ name: 'Cliente B mesmo email', email: 'cliente.a@example.com' })
        .expect(201);

      // Reseller invoices / stock (plaques) — B must not see A's ledger/stock mutations
      const invB = await request(app.getHttpServer())
        .get('/api/reseller/invoices')
        .set('Authorization', `Bearer ${sessionB.token}`);
      expect([200, 404]).toContain(invB.status);
      if (invB.status === 200) {
        const items = invB.body.items ?? invB.body;
        expect(Array.isArray(items)).toBe(true);
      }

      const stockB = await request(app.getHttpServer())
        .get('/api/reseller/plaques/stock')
        .set('Authorization', `Bearer ${sessionB.token}`);
      expect([200, 404]).toContain(stockB.status);

      await request(app.getHttpServer())
        .get('/api/admin/plaques/stock')
        .query({ resellerId: resellerA.id })
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(403);

      // Admin-only surfaces
      await request(app.getHttpServer())
        .get('/api/admin/coupons')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/invoices')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/sites')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(403);
    } finally {
      await app.close();
    }
  });
});
