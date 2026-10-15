import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

describe('coupon redeem concurrency', () => {
  it('does not exceed maxUses under N concurrent redeems', async () => {
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

    const admin = await insertUser('ADMIN');
    const adminSession = loginAs('ADMIN', {
      supabaseId: admin.supabaseId,
      aal: 'aal2',
    });

    await adminPrisma.coupon.create({
      data: {
        code: 'RACE10',
        type: 'PCT',
        value: 10,
        active: true,
        maxUses: 10,
        usedCount: 0,
      },
    });

    const { app } = await createTestApp();
    try {
      const N = 40;
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          request(app.getHttpServer())
            .post('/api/admin/coupons/redeem')
            .set('Authorization', `Bearer ${adminSession.token}`)
            .set('Idempotency-Key', `redeem-${i}`)
            .send({ code: 'RACE10', amountCents: 10_000 })
            .then((res) => res.status)
            .catch(() => 500),
        ),
      );

      const ok = results.filter((s) => s === 201 || s === 200).length;
      const rejected = results.filter((s) => s === 409 || s === 400).length;
      expect(ok).toBe(10);
      expect(rejected).toBe(N - 10);

      const coupon = await adminPrisma.coupon.findUniqueOrThrow({
        where: { code: 'RACE10' },
      });
      expect(coupon.usedCount).toBe(10);
    } finally {
      await app.close();
    }
  });
});
