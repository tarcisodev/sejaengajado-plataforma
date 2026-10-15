import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { ByHostCache } from '../../src/public/sites/by-host.cache';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedPublishedSite() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'Pub', monthlyFeeCents: 1 },
  });
  const reseller = await adminPrisma.reseller.create({
    data: { name: 'R', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const sitePlan = await adminPrisma.plan.create({
    data: {
      code: `P_${randomUUID().slice(0, 8)}`,
      name: 'Pronto',
      type: 'ONE_TIME',
      priceCents: 1000,
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
  const customer = await adminPrisma.customer.create({
    data: { resellerId: reseller.id, name: 'C' },
  });
  const site = await adminPrisma.site.create({
    data: {
      resellerId: reseller.id,
      customerId: customer.id,
      slug: 'teste',
      templateId: template.id,
      planId: sitePlan.id,
      status: 'PUBLISHED',
      editable: true,
      content: {
        theme: { niche: 'generico' },
        googleReviewUrl: 'https://g.page/r/review-demo',
      },
      publishedAt: new Date(),
    },
  });
  const user = await insertUser('RESELLER', { resellerId: reseller.id });
  return { site, template, user, reseller };
}

describe('public by-host and avaliar', () => {
  it('resolves host with port/case, rejects reserved, invalidates cache, hashes scan IP', async () => {
    const seeded = await seedPublishedSite();
    const session = loginAs('RESELLER', {
      supabaseId: seeded.user.supabaseId,
      resellerId: seeded.reseller.id,
    });
    const { adminPrisma } = getHarnessPostgres();
    const { app } = await createTestApp();

    try {
      const resolved = await request(app.getHttpServer())
        .get('/api/public/sites/by-host')
        .query({ host: 'Teste.SejaEngajado.com.br:443' })
        .expect(200);
      expect(resolved.body.slug).toBe('teste');
      expect(resolved.body.templateKey).toBe(seeded.template.key);
      expect(resolved.body.temporarilyUnavailable).toBe(false);
      expect(resolved.headers['cache-control']).toContain('max-age=60');
      expect(resolved.headers.etag).toBeTruthy();

      await request(app.getHttpServer())
        .get('/api/public/sites/by-host')
        .query({ host: 'app.sejaengajado.com.br' })
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/public/sites/by-host')
        .query({ host: 'sejaengajado.com.br' })
        .expect(404);

      const cache = app.get(ByHostCache);
      expect(cache.get('teste.sejaengajado.com.br')).toBeTruthy();

      await request(app.getHttpServer())
        .patch(`/api/reseller/sites/${seeded.site.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          content: {
            theme: { niche: 'barbearia', brandColor: '#112233' },
            googleReviewUrl: 'https://g.page/r/review-demo',
          },
        })
        .expect(200);
      expect(cache.get('teste.sejaengajado.com.br')).toBeUndefined();

      await request(app.getHttpServer())
        .get('/api/public/sites/by-host')
        .query({ host: 'teste.sejaengajado.com.br' })
        .expect(200);
      expect(cache.get('teste.sejaengajado.com.br')).toBeTruthy();

      await request(app.getHttpServer())
        .post(`/api/reseller/sites/${seeded.site.id}/publish`)
        .set('Authorization', `Bearer ${session.token}`)
        .expect(201);
      expect(cache.get('teste.sejaengajado.com.br')).toBeUndefined();

      const redirect = await request(app.getHttpServer())
        .get('/api/public/r/teste/avaliar')
        .set('X-Forwarded-For', '203.0.113.50')
        .expect(302);
      expect(redirect.headers.location).toBe('https://g.page/r/review-demo');

      // Same hashed IP in the window: still redirects, but does not duplicate ScanEvent.
      await request(app.getHttpServer())
        .get('/api/public/r/teste/avaliar')
        .set('X-Forwarded-For', '203.0.113.50')
        .expect(302);

      const scans = await adminPrisma.scanEvent.findMany({
        where: { siteId: seeded.site.id },
      });
      expect(scans).toHaveLength(1);
      expect(scans[0].ipHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(scans)).not.toContain('203.0.113.50');
    } finally {
      await app.close();
    }
  });
});
