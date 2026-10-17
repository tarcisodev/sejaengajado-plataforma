import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedJobsWorld() {
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

  const proPlan = await adminPrisma.plan.create({
    data: {
      code: `PRO_${randomUUID().slice(0, 8)}`,
      name: 'Pro',
      type: 'RECURRING',
      priceCents: 4900,
      interval: 'MONTH',
    },
  });
  const prontoPlan = await adminPrisma.plan.create({
    data: {
      code: `PRONTO_${randomUUID().slice(0, 8)}`,
      name: 'Pronto',
      type: 'ONE_TIME',
      priceCents: 29900,
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
  const customerB = await adminPrisma.customer.create({
    data: { resellerId: resellerB.id, name: 'CB' },
  });

  // Fidelity ends exactly 12 months after the SUSPEND day used below (2026-03-26).
  const sitePro = await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: `pro-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: proPlan.id,
      status: 'PUBLISHED',
      editable: true,
      plaqueFidelityEndsAt: new Date('2027-03-26T00:00:00.000Z'),
    },
  });
  const sitePronto = await adminPrisma.site.create({
    data: {
      resellerId: resellerA.id,
      customerId: customerA.id,
      slug: `pronto-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: prontoPlan.id,
      status: 'PUBLISHED',
      editable: false,
      hostingRenewsAt: new Date('2026-03-10T18:00:00.000Z'),
    },
  });
  const siteB = await adminPrisma.site.create({
    data: {
      resellerId: resellerB.id,
      customerId: customerB.id,
      slug: `b-${randomUUID().slice(0, 8)}`,
      templateId: template.id,
      planId: proPlan.id,
      status: 'PUBLISHED',
      editable: true,
    },
  });

  await adminPrisma.subscription.create({
    data: {
      resellerId: resellerA.id,
      siteId: sitePro.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2026-03-10T18:00:00.000Z'),
    },
  });
  await adminPrisma.subscription.create({
    data: {
      resellerId: resellerB.id,
      siteId: siteB.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2026-03-10T18:00:00.000Z'),
    },
  });

  const admin = await insertUser('ADMIN');
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });

  return {
    resellerA,
    resellerB,
    sitePro,
    sitePronto,
    siteB,
    admin,
    userA,
    userB,
  };
}

describe('jobs overdue lifecycle', () => {
  it('applies SP day bands, is idempotent, records penalty and isolates A↔B', async () => {
    const seeded = await seedJobsWorld();
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

    const { app, jobMailer } = await createTestApp();
    const { adminPrisma } = getHarnessPostgres();
    try {
      // Day 1 (2026-03-11 SP) → WARN only (email), status stays PUBLISHED
      await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .set('Idempotency-Key', 'jobs-d1')
        .send({ now: '2026-03-11T15:00:00.000Z' })
        .expect(201)
        .expect(({ body }) => {
          // 1 e-mail per reseller (A has 2 sites; B has 1) → 2
          expect(body.emailsSent).toBe(2);
          expect(body.warned).toBe(2);
          expect(body.transitioned).toBe(0);
        });

      expect(jobMailer.sent).toHaveLength(2);
      expect(new Set(jobMailer.sent.map((m) => m.resellerId)).size).toBe(2);

      const afterWarn = await adminPrisma.site.findUniqueOrThrow({
        where: { id: seeded.sitePro.id },
      });
      expect(afterWarn.status).toBe('PUBLISHED');

      // Re-run same day → idempotent (no extra warn)
      const rerun = await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-03-11T18:00:00.000Z' })
        .expect(201);
      expect(rerun.body.warned).toBe(0);

      // Day 8 → READ_ONLY
      await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-03-18T15:00:00.000Z' })
        .expect(201);

      const readOnly = await adminPrisma.site.findUniqueOrThrow({
        where: { id: seeded.sitePro.id },
      });
      expect(readOnly.status).toBe('READ_ONLY');
      expect(readOnly.editable).toBe(false);

      // Day 16 → SUSPENDED + penalty (12 months remaining → full plaque value)
      await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-03-26T15:00:00.000Z' })
        .expect(201);

      const suspended = await adminPrisma.site.findUniqueOrThrow({
        where: { id: seeded.sitePro.id },
      });
      expect(suspended.status).toBe('SUSPENDED');

      const penaltyEvent = await adminPrisma.lifecycleEvent.findFirst({
        where: {
          siteId: seeded.sitePro.id,
          toStatus: 'SUSPENDED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(penaltyEvent?.penaltyCents).toBe(9900);

      // Day 60 → ARCHIVED
      await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-05-09T15:00:00.000Z' })
        .expect(201);

      const archived = await adminPrisma.site.findUniqueOrThrow({
        where: { id: seeded.sitePro.id },
      });
      expect(archived.status).toBe('ARCHIVED');

      const prontoEvents = await adminPrisma.lifecycleEvent.findMany({
        where: {
          siteId: seeded.sitePronto.id,
          reason: { startsWith: 'PRONTO_RENEWAL_DUE:' },
        },
      });
      expect(prontoEvents.length).toBe(1);

      const idle = await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-05-10T15:00:00.000Z' })
        .expect(201);
      expect(idle.body.transitioned).toBe(0);

      for (const session of [sessionA, sessionB]) {
        await request(app.getHttpServer())
          .post('/api/admin/jobs/run')
          .set('Authorization', `Bearer ${session.token}`)
          .send({ now: '2026-05-10T15:00:00.000Z' })
          .expect(403);
      }

      const siteB = await adminPrisma.site.findUniqueOrThrow({ where: { id: seeded.siteB.id } });
      expect(siteB.status).toBe('ARCHIVED');
    } finally {
      await app.close();
    }
  });

  it('allows admin with aal1 (MFA optional)', async () => {
    const seeded = await seedJobsWorld();
    const aal1 = loginAs('ADMIN', {
      supabaseId: seeded.admin.supabaseId,
      aal: 'aal1',
    });
    const { app } = await createTestApp();
    try {
      await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${aal1.token}`)
        .send({})
        .expect(201);
    } finally {
      await app.close();
    }
  });
});
