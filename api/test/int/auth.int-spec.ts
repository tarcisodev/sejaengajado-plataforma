import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import request from 'supertest';

import type { SupabaseAdminClient } from '../../src/auth/supabase-admin';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';

function signToken(
  claims: Record<string, unknown>,
  options: jwt.SignOptions & { secret?: string } = {},
): string {
  const secret = options.secret ?? process.env.TEST_JWT_SECRET ?? 'test-supabase-jwt-secret';
  const { secret: _ignored, ...signOptions } = options;
  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    audience: process.env.TEST_JWT_AUD ?? 'authenticated',
    issuer: process.env.TEST_JWT_ISS ?? 'http://127.0.0.1/auth/v1',
    expiresIn: '1h',
    ...signOptions,
  });
}

describe('supabase auth guard', () => {
  it('rejects invalid signature, iss, aud and exp with 401', async () => {
    const user = await insertUser('RESELLER');
    const { app } = await createTestApp();
    try {
      const base = {
        sub: user.supabaseId,
        role: 'authenticated',
        aal: 'aal1',
      };

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${signToken(base, { secret: 'wrong-secret' })}`)
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(
          'Authorization',
          `Bearer ${signToken(base, { issuer: 'http://evil.example/auth/v1' })}`,
        )
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${signToken(base, { audience: 'service_role' })}`)
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(
          'Authorization',
          `Bearer ${signToken(base, { expiresIn: '-10s' })}`,
        )
        .expect(401);
    } finally {
      await app.close();
    }
  });

  it('ignores forged role/resellerId claims and reads from the DB', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const plan = await adminPrisma.resellerPlan.create({
      data: { name: 'P', monthlyFeeCents: 1 },
    });
    const reseller = await adminPrisma.reseller.create({
      data: { name: 'R', resellerPlanId: plan.id, status: 'ACTIVE' },
    });
    const user = await insertUser('RESELLER', { resellerId: reseller.id });
    const forged = loginAs('ADMIN', {
      supabaseId: user.supabaseId,
      resellerId: randomUUID(),
      aal: 'aal2',
    });

    const { app } = await createTestApp();
    try {
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged.token}`)
        .expect(200);

      expect(me.body).toMatchObject({
        id: user.id,
        role: 'RESELLER',
        resellerId: reseller.id,
        resellerStatus: 'ACTIVE',
      });
      expect(me.body.role).not.toBe('ADMIN');
    } finally {
      await app.close();
    }
  });

  it('exposes resellerStatus DELINQUENT on /auth/me for banner gating', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const plan = await adminPrisma.resellerPlan.create({
      data: { name: 'P2', monthlyFeeCents: 1 },
    });
    const reseller = await adminPrisma.reseller.create({
      data: {
        name: 'Atrasado',
        resellerPlanId: plan.id,
        status: 'DELINQUENT',
        delinquentSince: new Date(),
      },
    });
    const user = await insertUser('RESELLER', { resellerId: reseller.id });
    const session = loginAs('RESELLER', { supabaseId: user.supabaseId });
    const { app } = await createTestApp();
    try {
      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);
      expect(me.body.resellerStatus).toBe('DELINQUENT');
    } finally {
      await app.close();
    }
  });

  it('allows admin with aal1 on ADMIN routes (MFA optional)', async () => {
    const admin = await insertUser('ADMIN');
    const session = loginAs('ADMIN', { supabaseId: admin.supabaseId, aal: 'aal1' });
    const { app } = await createTestApp();
    try {
      await request(app.getHttpServer())
        .get('/api/admin/session/ping')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);
    } finally {
      await app.close();
    }
  });

  it('returns AUTH_NOT_INVITED for a valid Supabase token without a User row', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const before = await adminPrisma.user.count();
    const session = loginAs('RESELLER', { supabaseId: randomUUID() });
    const { app } = await createTestApp();
    try {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(403);
      expect(res.body.code).toBe('AUTH_NOT_INVITED');
      expect(await adminPrisma.user.count()).toBe(before);
    } finally {
      await app.close();
    }
  });

  it('rejects inactive users and never auto-creates a User', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const user = await insertUser('CUSTOMER');
    await adminPrisma.user.update({
      where: { id: user.id },
      data: { status: 'DISABLED' },
    });
    const before = await adminPrisma.user.count();
    const session = loginAs('CUSTOMER', { supabaseId: user.supabaseId });
    const { app } = await createTestApp();
    try {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(403);
      expect(await adminPrisma.user.count()).toBe(before);
    } finally {
      await app.close();
    }
  });

  it('invites through a mocked Supabase Admin API and creates the User row', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const plan = await adminPrisma.resellerPlan.create({
      data: { name: 'Invite plan', monthlyFeeCents: 1 },
    });
    const reseller = await adminPrisma.reseller.create({
      data: { name: 'Invite R', resellerPlanId: plan.id, status: 'ACTIVE' },
    });
    const admin = await insertUser('ADMIN');
    const adminSession = loginAs('ADMIN', {
      supabaseId: admin.supabaseId,
      aal: 'aal2',
    });

    const invitedId = randomUUID();
    const supabaseAdmin: SupabaseAdminClient = {
      inviteUserByEmail: jest.fn(async (email: string) => ({
        id: invitedId,
        email,
      })),
      generateRecoveryLink: jest.fn(async () => ({
        actionLink: 'https://example.com/reset',
      })),
      unenrollMfaFactors: jest.fn(async () => ({ removed: 0 })),
    };

    const { app } = await createTestApp({ supabaseAdmin });
    try {
      const invited = await request(app.getHttpServer())
        .post('/api/admin/auth/invite')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({
          email: 'novo-revendedor@example.com',
          role: 'RESELLER',
          resellerId: reseller.id,
        })
        .expect(201);

      expect(invited.body.supabaseId).toBe(invitedId);
      expect(supabaseAdmin.inviteUserByEmail).toHaveBeenCalledWith(
        'novo-revendedor@example.com',
      );

      const row = await adminPrisma.user.findUnique({ where: { supabaseId: invitedId } });
      expect(row?.role).toBe('RESELLER');
      expect(row?.resellerId).toBe(reseller.id);

      const reset = await request(app.getHttpServer())
        .post('/api/admin/auth/reset-link')
        .set('Authorization', `Bearer ${adminSession.token}`)
        .send({ email: 'novo-revendedor@example.com' })
        .expect(201);
      expect(reset.body.actionLink).toContain('https://example.com/reset');
    } finally {
      await app.close();
    }
  });
});
