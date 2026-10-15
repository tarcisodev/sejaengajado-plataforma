import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedWarnSites(resellerCount: number, sitesPerReseller: number) {
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
  const proPlan = await adminPrisma.plan.create({
    data: {
      code: `PRO_${randomUUID().slice(0, 8)}`,
      name: 'Pro',
      type: 'RECURRING',
      priceCents: 4900,
      interval: 'MONTH',
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

  const resellers: { id: string; userId: string; supabaseId: string }[] = [];
  for (let r = 0; r < resellerCount; r += 1) {
    const reseller = await adminPrisma.reseller.create({
      data: { name: `R${r}`, resellerPlanId: plan.id, status: 'ACTIVE' },
    });
    const user = await insertUser('RESELLER', {
      resellerId: reseller.id,
      email: `r${r}-${randomUUID().slice(0, 8)}@example.com`,
    });
    const customer = await adminPrisma.customer.create({
      data: { resellerId: reseller.id, name: `C${r}` },
    });
    for (let s = 0; s < sitesPerReseller; s += 1) {
      const site = await adminPrisma.site.create({
        data: {
          resellerId: reseller.id,
          customerId: customer.id,
          slug: `s-${r}-${s}-${randomUUID().slice(0, 6)}`,
          templateId: template.id,
          planId: proPlan.id,
          status: 'PUBLISHED',
          editable: true,
        },
      });
      await adminPrisma.subscription.create({
        data: {
          resellerId: reseller.id,
          siteId: site.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2026-03-10T18:00:00.000Z'),
        },
      });
    }
    resellers.push({
      id: reseller.id,
      userId: user.id,
      supabaseId: user.supabaseId,
    });
  }

  const admin = await insertUser('ADMIN');
  return { admin, resellers };
}

describe('jobs overdue e-mail dedupe', () => {
  const prevCap = process.env.JOBS_EMAIL_CAP;

  afterEach(() => {
    if (prevCap === undefined) {
      delete process.env.JOBS_EMAIL_CAP;
    } else {
      process.env.JOBS_EMAIL_CAP = prevCap;
    }
  });

  it('sends at most 1 e-mail per reseller per band/day and respects global cap', async () => {
    process.env.JOBS_EMAIL_CAP = '2';
    const seeded = await seedWarnSites(3, 4);
    const adminSession = loginAs('ADMIN', {
      supabaseId: seeded.admin.supabaseId,
      aal: 'aal2',
    });

    const { app, jobMailer } = await createTestApp();
    const { adminPrisma } = getHarnessPostgres();
    try {
      // Day 1 WARN — 3 resellers × 4 sites, but cap=2 and 1/reseller/day
      const first = await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-03-11T15:00:00.000Z' })
        .expect(201);

      expect(first.body.emailsSent).toBe(2);
      expect(first.body.emailsSkippedCap).toBeGreaterThanOrEqual(1);
      expect(jobMailer.sent).toHaveLength(2);
      const resellerIds = new Set(jobMailer.sent.map((m) => m.resellerId));
      expect(resellerIds.size).toBe(2);

      const logs = await adminPrisma.jobEmailLog.findMany({
        where: { band: 'WARN', localDate: '2026-03-11' },
      });
      expect(logs).toHaveLength(2);

      // Same day re-run — dedupe + still capped for the third
      jobMailer.sent.length = 0;
      const second = await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-03-11T18:00:00.000Z' })
        .expect(201);

      // Third reseller still not logged (was capped, no persist) → can send now
      expect(second.body.emailsSent).toBe(1);
      expect(jobMailer.sent).toHaveLength(1);
      expect(
        await adminPrisma.jobEmailLog.count({
          where: { band: 'WARN', localDate: '2026-03-11' },
        }),
      ).toBe(3);

      // Another same-day run — all deduped
      jobMailer.sent.length = 0;
      const third = await request(app.getHttpServer())
        .post('/api/admin/jobs/run')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ now: '2026-03-11T20:00:00.000Z' })
        .expect(201);
      expect(third.body.emailsSent).toBe(0);
      expect(jobMailer.sent).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
