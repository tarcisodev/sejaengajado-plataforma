import { randomUUID } from 'node:crypto';

import request from 'supertest';

import type { SupabaseAdminClient } from '../../src/auth/supabase-admin';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

describe('reseller happy path (go-live)', () => {
  it('admin invites reseller → customer+invite → site publish → by-host → /customer/sites', async () => {
    const { adminPrisma } = getHarnessPostgres();
    await truncateAll();

    const fundador = await adminPrisma.resellerPlan.upsert({
      where: { id: '00000000-0000-4000-8000-000000000002' },
      create: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Fundador',
        monthlyFeeCents: 0,
        siteLimit: null,
      },
      update: { name: 'Fundador', monthlyFeeCents: 0 },
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
        name: 'Barbearia',
        niche: 'barbearia',
        schemaType: 'HairSalon',
      },
    });

    const admin = await insertUser('ADMIN');
    const adminSession = loginAs('ADMIN', {
      supabaseId: admin.supabaseId,
      aal: 'aal2',
    });

    const invitedResellerSb = randomUUID();
    const invitedCustomerSb = randomUUID();
    const supabaseAdmin: SupabaseAdminClient = {
      inviteUserByEmail: jest.fn(async (email: string) => ({
        id: email.includes('cliente') ? invitedCustomerSb : invitedResellerSb,
        email,
      })),
      generateRecoveryLink: jest.fn(async () => ({
        actionLink: 'https://example.com/invite',
      })),
    };

    const { app } = await createTestApp({ supabaseAdmin });
    try {
      const resellerRes = await request(app.getHttpServer())
        .post('/api/admin/resellers')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          name: 'Revenda GoLive',
          email: 'revenda.golive@example.com',
          resellerPlanId: fundador.id,
        })
        .expect(201);
      const resellerId = resellerRes.body.id as string;

      const resellerUser = await adminPrisma.user.findFirstOrThrow({
        where: { resellerId, role: 'RESELLER' },
      });
      const resellerSession = loginAs('RESELLER', {
        supabaseId: resellerUser.supabaseId,
        resellerId,
      });

      const customerRes = await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${resellerSession.token}`)
        .send({
          name: 'Barbearia Central',
          email: 'cliente.golive@example.com',
          city: 'Uberaba',
          whatsapp: '5534999990000',
        })
        .expect(201);
      expect(customerRes.body.email).toBe('cliente.golive@example.com');
      expect(customerRes.body.inviteActionLink).toBeTruthy();

      const customerUser = await adminPrisma.user.findFirstOrThrow({
        where: { email: 'cliente.golive@example.com', role: 'CUSTOMER' },
      });
      expect(customerUser.resellerId).toBe(resellerId);

      const slug = `golive-${randomUUID().slice(0, 8)}`;
      const siteRes = await request(app.getHttpServer())
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${resellerSession.token}`)
        .send({
          customerId: customerRes.body.id,
          slug,
          templateId: template.id,
          planId: sitePlan.id,
          content: {
            theme: { niche: 'barbearia', brandColor: '#1e3a5f' },
            pix: { key: 'chave-pix', receiverName: 'Barbearia Central' },
          },
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/reseller/sites/${siteRes.body.id}/publish`)
        .set('Authorization', `Bearer ${resellerSession.token}`)
        .expect(201);

      const publicSite = await request(app.getHttpServer())
        .get('/api/public/sites/by-host')
        .query({ host: `${slug}.sejaengajado.com.br` })
        .expect(200);
      expect(publicSite.body.slug).toBe(slug);

      const customerSession = loginAs('CUSTOMER', {
        supabaseId: customerUser.supabaseId,
        resellerId,
      });
      const mine = await request(app.getHttpServer())
        .get('/api/customer/sites')
        .set('Authorization', `Bearer ${customerSession.token}`)
        .expect(200);
      const items = Array.isArray(mine.body) ? mine.body : mine.body.items;
      expect(items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: siteRes.body.id, slug })]),
      );
    } finally {
      await app.close();
    }
  });
});
