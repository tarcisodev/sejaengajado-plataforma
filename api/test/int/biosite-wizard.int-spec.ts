import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

/** #45: wizard "Novo site" (reseller + admin) and the public biosite reads. */
describe('biosite wizard happy path (#45)', () => {
  it('reseller drafts by steps, publishes, public by-slug/by-host serve it; admin publishes for another reseller', async () => {
    const { adminPrisma } = getHarnessPostgres();
    await truncateAll();

    const resellerPlan = await adminPrisma.resellerPlan.create({
      data: { name: 'Open', monthlyFeeCents: 1000, siteLimit: null },
    });
    const resellerA = await adminPrisma.reseller.create({
      data: { name: 'Rev A', resellerPlanId: resellerPlan.id, status: 'ACTIVE' },
    });
    const resellerB = await adminPrisma.reseller.create({
      data: { name: 'Rev B', resellerPlanId: resellerPlan.id, status: 'ACTIVE' },
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
        name: 'Biosite',
        niche: 'generico',
        schemaType: 'LocalBusiness',
      },
    });

    const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
    const userB = await insertUser('RESELLER', { resellerId: resellerB.id });
    const admin = await insertUser('ADMIN');
    const sessionA = loginAs('RESELLER', {
      supabaseId: userA.supabaseId,
      resellerId: resellerA.id,
    });
    const sessionB = loginAs('RESELLER', {
      supabaseId: userB.supabaseId,
      resellerId: resellerB.id,
    });
    const adminSession = loginAs('ADMIN', { supabaseId: admin.supabaseId, aal: 'aal2' });

    const { app } = await createTestApp();
    const http = () => request(app.getHttpServer());
    const asA = <T extends request.Test>(req: T) =>
      req.set('Authorization', `Bearer ${sessionA.token}`);
    const asAdmin = <T extends request.Test>(req: T) =>
      req.set('Authorization', `Bearer ${adminSession.token}`);

    try {
      // --- Reseller A: create DRAFT -------------------------------------------------
      const customer = await asA(http().post('/api/reseller/customers'))
        .send({ name: 'Padaria Feliz', city: 'Uberaba' })
        .expect(201);

      const created = await asA(http().post('/api/reseller/sites'))
        .send({
          customerId: customer.body.id,
          slug: 'padaria-feliz',
          templateId: template.id,
          planId: sitePlan.id,
          content: { businessName: 'Padaria Feliz' },
        })
        .expect(201);
      expect(created.body.status).toBe('DRAFT');
      const siteId: string = created.body.id;

      // DRAFT is not public.
      const draftBySlug = await http().get('/api/public/sites/by-slug/padaria-feliz').expect(404);
      expect(draftBySlug.headers['cache-control']).toBe('private, no-store');
      const draftByHost = await http()
        .get('/api/public/sites/by-host?host=padaria-feliz.sejaengajado.com.br')
        .expect(404);
      expect(draftByHost.headers['cache-control']).toBe('private, no-store');

      // --- Wizard steps (merge:true) -----------------------------------------------
      const steps: Array<Record<string, unknown>> = [
        {
          profile: {
            nome: 'Padaria Feliz',
            slogan: 'Pão quentinho toda hora',
            logoUrl: 'https://cdn.example.com/r/logo.webp',
            coverUrl: 'https://cdn.example.com/r/capa.webp',
          },
        },
        {
          address: {
            logradouro: 'Rua das Flores',
            numero: '100',
            bairro: 'Centro',
            cidade: 'Uberaba',
            uf: 'MG',
            cep: '38000-000',
          },
        },
        {
          hours: [
            { dias: 'Seg a Sex', abre: '06:00', fecha: '20:00' },
            { dias: 'Domingo', fechado: true },
          ],
        },
        {
          catalog: {
            layout: 'grid',
            kind: 'catalogo',
            items: [
              { id: 'i1', nome: 'Pão francês', precoCentavos: 90 },
              { id: 'i2', nome: 'Bolo de fubá', precoCentavos: 2500 },
              { id: 'i3', nome: 'Café coado', precoCentavos: 650 },
            ],
          },
        },
        { pix: { enabled: true, key: 'padaria@example.com', receiverName: 'Padaria Feliz' } },
      ];
      for (const step of steps) {
        await asA(http().patch(`/api/reseller/sites/${siteId}/content`))
          .send({ merge: true, content: step })
          .expect(200);
      }

      // Unsafe URL scheme is rejected and does not touch stored content.
      const bad = await asA(http().patch(`/api/reseller/sites/${siteId}/content`))
        .send({ merge: true, content: { profile: { logoUrl: 'javascript:alert(1)' } } })
        .expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      expect(bad.body.fields.map((f: { path: string }) => f.path)).toContain(
        'content.profile.logoUrl',
      );
      const badLink = await asA(http().patch(`/api/reseller/sites/${siteId}`))
        .send({ merge: true, content: { links: [{ titulo: 'x', url: ' JaVa\tScript:alert(1)' }] } })
        .expect(400);
      expect(badLink.body.code).toBe('VALIDATION_FAILED');
      expect(badLink.body.fields.map((f: { path: string }) => f.path)).toContain(
        'content.links.0.url',
      );

      const draft = await asA(http().get(`/api/reseller/sites/${siteId}`)).expect(200);
      expect(draft.body.content.businessName).toBe('Padaria Feliz');
      expect(draft.body.content.profile.logoUrl).toBe('https://cdn.example.com/r/logo.webp');
      expect(draft.body.content.catalog.items).toHaveLength(3);
      expect(draft.body.status).toBe('DRAFT');

      // --- Publish -----------------------------------------------------------------
      const published = await asA(http().post(`/api/reseller/sites/${siteId}/publish`)).expect(
        201,
      );
      expect(published.body.status).toBe('PUBLISHED');

      const bySlug = await http().get('/api/public/sites/by-slug/Padaria-Feliz').expect(200);
      expect(bySlug.headers['cache-control']).toBe('private, no-store');
      expect(bySlug.headers.etag).toMatch(/^W\/"/);
      const byHost = await http()
        .get('/api/public/sites/by-host?host=padaria-feliz.sejaengajado.com.br')
        .expect(200);
      expect(byHost.headers['cache-control']).toBe('private, no-store');
      expect(byHost.body).toEqual(bySlug.body);

      const body = bySlug.body;
      expect(body.slug).toBe('padaria-feliz');
      expect(body.status).toBe('PUBLISHED');
      expect(body.templateKey).toBe(template.key);
      expect(body.schemaType).toBe('LocalBusiness');
      expect(body.temporarilyUnavailable).toBe(false);
      expect(body.content.businessName).toBe('Padaria Feliz');
      expect(body.content.profile).toMatchObject({
        nome: 'Padaria Feliz',
        logoUrl: 'https://cdn.example.com/r/logo.webp',
        coverUrl: 'https://cdn.example.com/r/capa.webp',
      });
      expect(body.content.address).toMatchObject({ cidade: 'Uberaba', uf: 'MG' });
      expect(body.content.hours).toHaveLength(2);
      expect(body.content.catalog.items.map((i: { precoCentavos: number }) => i.precoCentavos)).toEqual([
        90, 2500, 650,
      ]);
      expect(body.content.pix).toMatchObject({
        enabled: true,
        key: 'padaria@example.com',
        receiverName: 'Padaria Feliz',
      });

      // Malformed slug → 404 without DB lookup.
      const malformed = await http().get('/api/public/sites/by-slug/-bad-').expect(404);
      expect(malformed.headers['cache-control']).toBe('private, no-store');
      await http().get('/api/public/sites/by-slug/a_b').expect(404);

      // Isolation: reseller B cannot read, edit, publish or list A's site.
      const asB = <T extends request.Test>(req: T) =>
        req.set('Authorization', `Bearer ${sessionB.token}`);
      const beforeCross = await asA(http().get(`/api/reseller/sites/${siteId}`)).expect(200);
      await asB(http().get(`/api/reseller/sites/${siteId}`)).expect(404);
      await asB(http().patch(`/api/reseller/sites/${siteId}/content`))
        .send({ merge: true, content: { businessName: 'Hack' } })
        .expect(404);
      await asB(http().post(`/api/reseller/sites/${siteId}/publish`)).expect(404);
      const listB = await asB(http().get('/api/reseller/sites')).expect(200);
      expect(listB.body.items.map((s: { id: string }) => s.id)).not.toContain(siteId);
      const afterCross = await asA(http().get(`/api/reseller/sites/${siteId}`)).expect(200);
      expect(afterCross.body.status).toBe(beforeCross.body.status);
      expect(afterCross.body.content).toEqual(beforeCross.body.content);
      expect(afterCross.body.content.businessName).toBe('Padaria Feliz');

      // --- Admin: slug check with excludeId ---------------------------------------
      const taken = await asAdmin(http().get('/api/admin/slugs/check?slug=padaria-feliz')).expect(
        200,
      );
      expect(taken.body).toMatchObject({ available: false, code: 'SLUG_TAKEN' });
      const own = await asAdmin(
        http().get(`/api/admin/slugs/check?slug=padaria-feliz&excludeId=${siteId}`),
      ).expect(200);
      expect(own.body).toMatchObject({ slug: 'padaria-feliz', available: true });
      await asAdmin(http().get('/api/admin/slugs/check?slug=x&excludeId=not-a-uuid')).expect(400);

      const options = await asAdmin(http().get('/api/admin/site-options')).expect(200);
      expect(options.body.plans.map((p: { id: string }) => p.id)).toContain(sitePlan.id);
      expect(options.body.templates.map((t: { id: string }) => t.id)).toContain(template.id);

      // --- Admin publishes a site owned by reseller B -----------------------------
      const customerB = await http()
        .post('/api/reseller/customers')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .send({ name: 'Barbearia B', city: 'Uberaba' })
        .expect(201);
      const siteB = await http()
        .post('/api/reseller/sites')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .send({
          customerId: customerB.body.id,
          slug: 'barbearia-b',
          templateId: template.id,
          planId: sitePlan.id,
        })
        .expect(201);
      expect(siteB.body.resellerId).toBe(resellerB.id);

      await asAdmin(http().patch(`/api/admin/sites/${siteB.body.id}/content`))
        .send({
          merge: true,
          content: {
            businessName: 'Barbearia B',
            profile: { nome: 'Barbearia B', logoUrl: 'https://cdn.example.com/admin/logo.png' },
          },
        })
        .expect(200);
      await asAdmin(http().patch(`/api/admin/sites/${siteB.body.id}/content`))
        .send({ merge: true, content: { mapsUrl: 'javascript:alert(1)' } })
        .expect(400);
      const adminPublished = await asAdmin(
        http().post(`/api/admin/sites/${siteB.body.id}/publish`),
      ).expect(201);
      expect(adminPublished.body.status).toBe('PUBLISHED');
      expect(adminPublished.body.resellerId).toBe(resellerB.id);

      const publicB = await http().get('/api/public/sites/by-slug/barbearia-b').expect(200);
      expect(publicB.body.content.businessName).toBe('Barbearia B');
      expect(publicB.body.content.profile.logoUrl).toBe('https://cdn.example.com/admin/logo.png');
    } finally {
      await app.close();
    }
  });
});
