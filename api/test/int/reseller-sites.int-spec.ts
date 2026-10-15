import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { ByHostCache } from '../../src/public/sites/by-host.cache';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedResellerPair() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const planLimited = await adminPrisma.resellerPlan.create({
    data: { name: 'Limited', monthlyFeeCents: 1000, siteLimit: 1 },
  });
  const planOpen = await adminPrisma.resellerPlan.create({
    data: { name: 'Open', monthlyFeeCents: 1000, siteLimit: null },
  });

  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: planOpen.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: planOpen.id, status: 'ACTIVE' },
  });
  const resellerLimited = await adminPrisma.reseller.create({
    data: { name: 'Limited', resellerPlanId: planLimited.id, status: 'ACTIVE' },
  });
  const resellerBlocked = await adminPrisma.reseller.create({
    data: { name: 'Blocked', resellerPlanId: planOpen.id, status: 'BLOCKED' },
  });
  const resellerDelinquent = await adminPrisma.reseller.create({
    data: { name: 'Delinquent', resellerPlanId: planOpen.id, status: 'DELINQUENT' },
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

  await adminPrisma.reservedSlug.create({ data: { slug: 'www' } });
  await adminPrisma.reservedSlug.create({ data: { slug: 'admin' } });

  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });
  const userLimited = await insertUser('RESELLER', { resellerId: resellerLimited.id });
  const userBlocked = await insertUser('RESELLER', { resellerId: resellerBlocked.id });
  const userDelinquent = await insertUser('RESELLER', {
    resellerId: resellerDelinquent.id,
  });

  return {
    resellerA,
    resellerB,
    resellerLimited,
    sitePlan,
    template,
    userA,
    userB,
    userLimited,
    userBlocked,
    userDelinquent,
  };
}

describe('reseller customers and sites', () => {
  it('validates slugs, isolates A↔B, enforces content and operability', async () => {
    const seeded = await seedResellerPair();
    const sessionA = loginAs('RESELLER', {
      supabaseId: seeded.userA.supabaseId,
      resellerId: seeded.resellerA.id,
    });
    const sessionB = loginAs('RESELLER', {
      supabaseId: seeded.userB.supabaseId,
      resellerId: seeded.resellerB.id,
    });
    const sessionLimited = loginAs('RESELLER', {
      supabaseId: seeded.userLimited.supabaseId,
      resellerId: seeded.resellerLimited.id,
    });
    const sessionBlocked = loginAs('RESELLER', {
      supabaseId: seeded.userBlocked.supabaseId,
      resellerId: seeded.userBlocked.resellerId,
    });
    const sessionDelinquent = loginAs('RESELLER', {
      supabaseId: seeded.userDelinquent.supabaseId,
      resellerId: seeded.userDelinquent.resellerId,
    });

    const { app } = await createTestApp();
    try {
      const invalid = await request(app.getHttpServer())
        .get('/api/reseller/slugs/check?slug=ab')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(invalid.body.available).toBe(false);
      expect(invalid.body.code).toBe('SLUG_INVALID');

      const reserved = await request(app.getHttpServer())
        .get('/api/reseller/slugs/check?slug=www')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(reserved.body.available).toBe(false);
      expect(reserved.body.code).toBe('SLUG_RESERVED');

      const brand = await request(app.getHttpServer())
        .get('/api/reseller/slugs/check?slug=google')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(brand.body.available).toBe(false);
      expect(brand.body.code).toBe('SLUG_RESERVED');

      const customerA = await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ name: 'Cliente A', city: 'Uberaba' })
        .expect(201);

      const siteA = await request(app.getHttpServer())
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({
          customerId: customerA.body.id,
          slug: 'Barbearia-Ze',
          templateId: seeded.template.id,
          planId: seeded.sitePlan.id,
          content: {
            theme: { niche: 'barbearia', brandColor: '#abcdef' },
            sections: [{ type: 'hero', divisor: { shape: 'reta', height: 40 } }],
            strip: { enabled: false, motif: 'none', speed: 'normal', direction: 'left' },
          },
        })
        .expect(201);
      expect(siteA.body.slug).toBe('barbearia-ze');

      const caseClash = await request(app.getHttpServer())
        .get('/api/reseller/slugs/check?slug=BARBEARIA-ZE')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(caseClash.body.available).toBe(false);
      expect(caseClash.body.code).toBe('SLUG_TAKEN');

      const badColor = await request(app.getHttpServer())
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({
          customerId: customerA.body.id,
          slug: 'outra-loja',
          templateId: seeded.template.id,
          planId: seeded.sitePlan.id,
          content: { theme: { niche: 'generico', brandColor: 'not-a-color' } },
        })
        .expect(400);
      expect(badColor.body.code).toBe('VALIDATION_FAILED');
      expect(badColor.body.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: expect.stringContaining('brandColor') }),
        ]),
      );

      const cache = app.get(ByHostCache);
      cache.set('barbearia-ze.sejaengajado.com.br', { slug: 'barbearia-ze' }, '"etag"');
      expect(cache.get('barbearia-ze.sejaengajado.com.br')).toBeTruthy();

      await request(app.getHttpServer())
        .post(`/api/reseller/sites/${siteA.body.id}/publish`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(201);
      expect(cache.get('barbearia-ze.sejaengajado.com.br')).toBeUndefined();

      await request(app.getHttpServer())
        .get(`/api/reseller/sites/${siteA.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/reseller/sites/${siteA.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .send({ slug: 'hacked' })
        .expect(404);

      await request(app.getHttpServer())
        .post(`/api/reseller/sites/${siteA.body.id}/publish`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      const listedB = await request(app.getHttpServer())
        .get('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(listedB.body.items).toEqual([]);

      await request(app.getHttpServer())
        .get(`/api/reseller/customers/${customerA.body.id}`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      const blockedCreate = await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionBlocked.token}`)
        .send({ name: 'X' })
        .expect(403);
      expect(blockedCreate.body.code).toBe('RESELLER_BLOCKED');

      const delinquentCreate = await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionDelinquent.token}`)
        .send({ name: 'Y' })
        .expect(403);
      expect(delinquentCreate.body.code).toBe('RESELLER_DELINQUENT');

      const limitedCustomer = await request(app.getHttpServer())
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionLimited.token}`)
        .send({ name: 'Lim' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionLimited.token}`)
        .send({
          customerId: limitedCustomer.body.id,
          slug: 'unico-site',
          templateId: seeded.template.id,
          planId: seeded.sitePlan.id,
        })
        .expect(201);

      const limitHit = await request(app.getHttpServer())
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionLimited.token}`)
        .send({
          customerId: limitedCustomer.body.id,
          slug: 'segundo-site',
          templateId: seeded.template.id,
          planId: seeded.sitePlan.id,
        })
        .expect(403);
      expect(limitHit.body.code).toBe('SITE_LIMIT_REACHED');
    } finally {
      await app.close();
    }
  });
});
