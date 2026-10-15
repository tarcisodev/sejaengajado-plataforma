import { randomUUID } from 'node:crypto';

import request from 'supertest';

import type { SupabaseAdminClient } from '../../src/auth/supabase-admin';
import { ResellersService } from '../../src/admin/resellers/resellers.service';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';

describe('admin resellers', () => {
  it('blocks without reason, rejects operable when BLOCKED, and impersonate is read-only', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const admin = await insertUser('ADMIN');
    const session = loginAs('ADMIN', { supabaseId: admin.supabaseId, aal: 'aal2' });
    const plan = await adminPrisma.resellerPlan.create({
      data: { name: 'R plan', monthlyFeeCents: 500 },
    });

    const supabaseAdmin: SupabaseAdminClient = {
      inviteUserByEmail: jest.fn(async (email: string) => ({
        id: randomUUID(),
        email,
      })),
      generateRecoveryLink: jest.fn(async () => ({ actionLink: 'https://example.com' })),
    };

    const { app } = await createTestApp({ supabaseAdmin });
    try {
      const created = await request(app.getHttpServer())
        .post('/api/admin/resellers')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          name: 'Ops Reseller',
          email: 'ops@example.com',
          resellerPlanId: plan.id,
        })
        .expect(201);

      const resellerId = created.body.id as string;
      expect(supabaseAdmin.inviteUserByEmail).toHaveBeenCalled();

      const userRow = await adminPrisma.user.findFirst({
        where: { resellerId, role: 'RESELLER' },
      });
      expect(userRow?.supabaseId).toBeTruthy();

      const missingReason = await request(app.getHttpServer())
        .post(`/api/admin/resellers/${resellerId}/block`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({})
        .expect(400);
      expect(missingReason.body.code).toBe('VALIDATION_FAILED');
      expect(missingReason.body.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'reason' })]),
      );

      await request(app.getHttpServer())
        .post(`/api/admin/resellers/${resellerId}/block`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ reason: 'fraude' })
        .expect(201);

      const blocked = await adminPrisma.reseller.findUniqueOrThrow({ where: { id: resellerId } });
      expect(blocked.status).toBe('BLOCKED');

      const service = app.get(ResellersService);
      try {
        service.assertOperable('BLOCKED');
        throw new Error('expected RESELLER_BLOCKED');
      } catch (error) {
        expect(error).toMatchObject({
          response: { code: 'RESELLER_BLOCKED' },
        });
      }

      const before = await adminPrisma.reseller.findUniqueOrThrow({ where: { id: resellerId } });
      const imp = await request(app.getHttpServer())
        .post(`/api/admin/resellers/${resellerId}/impersonate`)
        .set('Authorization', `Bearer ${session.token}`)
        .expect(201);
      expect(imp.body.mode).toBe('read');
      const after = await adminPrisma.reseller.findUniqueOrThrow({ where: { id: resellerId } });
      expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
      expect(after.status).toBe(before.status);
    } finally {
      await app.close();
    }
  });
});
