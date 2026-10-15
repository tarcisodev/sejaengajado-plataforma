import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import { truncateAll } from '../setup/truncate';

async function seedLedgerWorld() {
  const { adminPrisma } = getHarnessPostgres();
  await truncateAll();

  const plan = await adminPrisma.resellerPlan.create({
    data: { name: 'L plan', monthlyFeeCents: 1000 },
  });
  const resellerA = await adminPrisma.reseller.create({
    data: { name: 'A', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const resellerB = await adminPrisma.reseller.create({
    data: { name: 'B', resellerPlanId: plan.id, status: 'ACTIVE' },
  });
  const userA = await insertUser('RESELLER', { resellerId: resellerA.id });
  const userB = await insertUser('RESELLER', { resellerId: resellerB.id });
  return { resellerA, resellerB, userA, userB };
}

describe('ledger', () => {
  it('reverses effect, opening+moves=closing, and isolates tenants', async () => {
    const seeded = await seedLedgerWorld();
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
      const t0 = new Date('2026-01-01T12:00:00.000Z');

      const inRes = await request(app.getHttpServer())
        .post('/api/reseller/ledger/entries')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ type: 'IN', amountCents: 1000 })
        .expect(201);
      expect(inRes.body.amountCents).toBe(1000);
      expect(inRes.body.category).toBe('MANUAL');

      await request(app.getHttpServer())
        .post('/api/reseller/ledger/entries')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ type: 'OUT', amountCents: 250 })
        .expect(201);

      const bal = await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(bal.body.balanceCents).toBe(750);

      const reverse = await request(app.getHttpServer())
        .post(`/api/reseller/ledger/entries/${inRes.body.id}/reverse`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(201);
      expect(reverse.body.category).toBe('REVERSAL');
      expect(reverse.body.type).toBe('OUT');
      expect(reverse.body.reversalOfId).toBe(inRes.body.id);

      const afterReverse = await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);
      expect(afterReverse.body.balanceCents).toBe(-250);

      await request(app.getHttpServer())
        .post(`/api/reseller/ledger/entries/${inRes.body.id}/reverse`)
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(409)
        .expect(({ body }) => {
          expect(body.code).toBe('ALREADY_REVERSED');
        });

      const raceTarget = await request(app.getHttpServer())
        .post('/api/reseller/ledger/entries')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ type: 'IN', amountCents: 50 })
        .expect(201);

      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app.getHttpServer())
            .post(`/api/reseller/ledger/entries/${raceTarget.body.id}/reverse`)
            .set('Authorization', `Bearer ${sessionA.token}`),
        ),
      );
      const ok = concurrent.filter((res) => res.status === 201);
      const conflicted = concurrent.filter((res) => res.status === 409);
      expect(ok).toHaveLength(1);
      expect(conflicted).toHaveLength(7);
      expect(conflicted.every((res) => res.body.code === 'ALREADY_REVERSED')).toBe(
        true,
      );

      // Fresh IN/OUT for statement identity opening + moves = closing
      await request(app.getHttpServer())
        .post('/api/reseller/ledger/entries')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ type: 'IN', amountCents: 500 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/reseller/ledger/entries')
        .set('Authorization', `Bearer ${sessionA.token}`)
        .send({ type: 'OUT', amountCents: 100 })
        .expect(201);

      const to = new Date();
      const statement = await request(app.getHttpServer())
        .get('/api/reseller/ledger')
        .query({ from: t0.toISOString(), to: to.toISOString(), limit: 100 })
        .set('Authorization', `Bearer ${sessionA.token}`)
        .expect(200);

      expect(statement.body.openingCents).toBe(0);
      const net = (statement.body.items as { type: string; amountCents: number }[]).reduce(
        (acc, row) => acc + (row.type === 'IN' ? row.amountCents : -row.amountCents),
        0,
      );
      expect(statement.body.openingCents + net).toBe(statement.body.closingCents);
      expect(statement.body.closingCents).toBe(afterReverse.body.balanceCents + 400);

      const listB = await request(app.getHttpServer())
        .get('/api/reseller/ledger')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200);
      expect(listB.body.items).toEqual([]);
      expect(listB.body.openingCents).toBe(0);
      expect(listB.body.closingCents).toBe(0);

      await request(app.getHttpServer())
        .post(`/api/reseller/ledger/entries/${inRes.body.id}/reverse`)
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/reseller/ledger/balance')
        .set('Authorization', `Bearer ${sessionB.token}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.balanceCents).toBe(0);
        });
    } finally {
      await app.close();
    }
  });
});
