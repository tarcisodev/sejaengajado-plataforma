import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { enterAuthUser } from '../../src/auth/auth.context';
import type { AuthUser } from '../../src/auth/auth-user';
import { redactSecrets } from '../../src/audit/audit.service';
import { ADMIN_PRISMA, type AdminPrisma } from '../../src/tenant/prisma.module';
import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';
import type { SupabaseAdminClient } from '../../src/auth/supabase-admin';

describe('audit log', () => {
  it('redacts secrets from diffs', () => {
    expect(
      redactSecrets({
        password: 'secret',
        token: 'abc',
        nested: { authorization: 'Bearer x', name: 'ok' },
      }),
    ).toEqual({
      password: '[Redacted]',
      token: '[Redacted]',
      nested: { authorization: '[Redacted]', name: 'ok' },
    });
  });

  it('creates logs for reseller create, wholesale window and ADJUST; append-only', async () => {
    const { adminPrisma } = getHarnessPostgres();
    const admin = await insertUser('ADMIN');
    const session = loginAs('ADMIN', { supabaseId: admin.supabaseId, aal: 'aal2' });
    const plan = await adminPrisma.resellerPlan.create({
      data: { name: 'Audit plan', monthlyFeeCents: 1000 },
    });
    const product = await adminPrisma.product.upsert({
      where: { code: 'PLAQUE_QR' },
      create: { code: 'PLAQUE_QR', name: 'QR', baseWholesaleCents: 100 },
      update: {},
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
          name: 'Audit Reseller',
          email: 'audit-reseller@example.com',
          resellerPlanId: plan.id,
          password: 'super-secret',
          token: 'should-not-leak',
        })
        .expect(201);

      const resellerId = created.body.id as string;

      await request(app.getHttpServer())
        .post(`/api/admin/resellers/${resellerId}/wholesale`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          productId: product.id,
          priceCents: 150,
          validFrom: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          validTo: null,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/admin/plaques/movements')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          resellerId,
          type: 'ADJUST',
          plaqueType: 'QR',
          qty: 3,
          reason: 'count',
        })
        .expect(201);

      const logs = await request(app.getHttpServer())
        .get('/api/admin/audit-logs?limit=20')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200);

      const actions = logs.body.items.map((row: { action: string }) => row.action);
      expect(actions).toEqual(
        expect.arrayContaining(['reseller.create', 'wholesale.create', 'plaque.movement']),
      );

      const serialized = JSON.stringify(logs.body);
      expect(serialized).not.toMatch(/super-secret/);
      expect(serialized).not.toMatch(/should-not-leak/);
      expect(serialized).toContain('[Redacted]');

      const first = logs.body.items[0];
      await expect(
        adminPrisma.auditLog.update({
          where: { id: first.id },
          data: { action: 'tamper' },
        }),
      ).rejects.toThrow(/append-only/);

      await expect(
        adminPrisma.auditLog.delete({ where: { id: first.id } }),
      ).rejects.toThrow(/append-only/);
    } finally {
      await app.close();
    }
  });
});

describe('ADMIN_PRISMA gate', () => {
  it('fails when a RESELLER context uses the admin client', async () => {
    const user = await insertUser('RESELLER');
    const { app } = await createTestApp();
    try {
      const adminPrisma = app.get<AdminPrisma>(ADMIN_PRISMA);
      const actor: AuthUser = {
        id: user.id,
        supabaseId: user.supabaseId,
        email: user.email,
        role: 'RESELLER',
        resellerId: user.resellerId ?? null,
        status: 'ACTIVE',
        resellerStatus: 'ACTIVE',
        aal: 'aal1',
      };
      enterAuthUser(actor);
      expect(() => adminPrisma.reseller.findMany()).toThrow(ForbiddenException);

      const customer = await insertUser('CUSTOMER');
      enterAuthUser({
        id: customer.id,
        supabaseId: customer.supabaseId,
        email: customer.email,
        role: 'CUSTOMER',
        resellerId: null,
        status: 'ACTIVE',
        resellerStatus: null,
        aal: 'aal1',
      });
      expect(() => adminPrisma.user.findMany()).toThrow(ForbiddenException);
    } finally {
      await app.close();
    }
  });

  it('allows ADMIN with aal2 to use the admin client', async () => {
    const admin = await insertUser('ADMIN');
    const { app } = await createTestApp();
    try {
      const adminPrisma = app.get<AdminPrisma>(ADMIN_PRISMA);
      enterAuthUser({
        id: admin.id,
        supabaseId: admin.supabaseId,
        email: admin.email,
        role: 'ADMIN',
        resellerId: null,
        status: 'ACTIVE',
        resellerStatus: null,
        aal: 'aal2',
      });
      await expect(adminPrisma.resellerPlan.findMany()).resolves.toBeDefined();
    } finally {
      await app.close();
    }
  });
});
