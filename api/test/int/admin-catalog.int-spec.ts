import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

describe('admin sites / customers / payments', () => {
  it('lists globally, creates site via customer reseller, filters payments by period', async () => {
    const { adminPrisma } = getHarnessPostgres();
    await truncateAll();

    const admin = await insertUser('ADMIN');
    const session = loginAs('ADMIN', { supabaseId: admin.supabaseId, aal: 'aal2' });
    const aal1 = loginAs('ADMIN', { supabaseId: admin.supabaseId, aal: 'aal1' });

    const resellerPlan = await adminPrisma.resellerPlan.create({
      data: { name: 'Open', monthlyFeeCents: 1000, siteLimit: null },
    });
    const reseller = await adminPrisma.reseller.create({
      data: { name: 'Rev', resellerPlanId: resellerPlan.id, status: 'ACTIVE' },
    });
    const customer = await adminPrisma.customer.create({
      data: {
        resellerId: reseller.id,
        name: 'Cliente Admin',
        doc: '123',
        whatsapp: '11999999999',
        city: 'SP',
      },
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
        name: 'Personalizado',
        niche: 'generico',
        schemaType: 'LocalBusiness',
      },
    });

    const order = await adminPrisma.order.create({
      data: {
        planId: sitePlan.id,
        resellerId: reseller.id,
        status: 'PAID',
        amountCents: 5000,
      },
    });
    await adminPrisma.payment.create({
      data: {
        orderId: order.id,
        resellerId: reseller.id,
        method: 'PIX',
        status: 'PAID',
        amountCents: 5000,
        paidAt: new Date('2026-06-15T12:00:00.000Z'),
        gatewayPaymentId: `gw_${randomUUID().slice(0, 8)}`,
      },
    });

    const { app } = await createTestApp();
    try {
      await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set('Authorization', `Bearer ${aal1.token}`)
        .expect(403);

      const customers = await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);
      expect(customers.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: customer.id, name: 'Cliente Admin' }),
        ]),
      );

      const created = await request(app.getHttpServer())
        .post('/api/admin/sites')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          customerId: customer.id,
          slug: `admin-${randomUUID().slice(0, 8)}`,
          templateId: template.id,
          planId: sitePlan.id,
        })
        .expect(201);
      expect(created.body).toMatchObject({
        customerId: customer.id,
        resellerId: reseller.id,
        status: 'DRAFT',
      });

      const sites = await request(app.getHttpServer())
        .get('/api/admin/sites')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);
      expect(sites.body.items.length).toBeGreaterThanOrEqual(1);

      const inPeriod = await request(app.getHttpServer())
        .get('/api/admin/payments?from=2026-06-01&to=2026-06-30')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);
      expect(inPeriod.body.items).toHaveLength(1);
      expect(inPeriod.body.items[0].amountCents).toBe(5000);

      const outPeriod = await request(app.getHttpServer())
        .get('/api/admin/payments?from=2026-01-01&to=2026-01-31')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);
      expect(outPeriod.body.items).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
