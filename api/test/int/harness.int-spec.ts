import jwt from 'jsonwebtoken';
import request from 'supertest';

import { insertUser } from '../setup/factories';
import { createTestApp } from '../setup/create-test-app';
import { FakeGateway } from '../setup/fake-gateway';
import { loginAs } from '../setup/login-as';
import { getHarnessPostgres } from '../setup/postgres';

describe('testcontainers harness', () => {
  it('uses a real Postgres 16, not SQLite and not a Prisma mock', async () => {
    const { prisma, appUrl } = getHarnessPostgres();
    const rows = await prisma.$queryRaw<{ v: string }[]>`SELECT version() AS v`;

    expect(appUrl).toMatch(/^postgresql:/);
    expect(appUrl).not.toMatch(/sqlite/i);
    expect(rows[0]?.v).toMatch(/PostgreSQL 16/);
    expect(jest.isMockFunction(prisma.$queryRaw)).toBe(false);
    expect(jest.isMockFunction(prisma.user.create)).toBe(false);
  });

  it('applies migrations and talks through the app role without BYPASSRLS', async () => {
    const user = await insertUser('CUSTOMER');
    const { prisma, adminPrisma, adminUrl } = getHarnessPostgres();
    const listed = await adminPrisma.user.findMany();
    expect(listed.map((row) => row.email)).toContain(user.email);
    // FORCE RLS: se_app without app.reseller_id sees zero scoped rows.
    expect(await prisma.user.findMany()).toEqual([]);

    const { PrismaClient } = await import('@prisma/client');
    const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    try {
      const roles = await admin.$queryRaw<{ rolname: string; rolbypassrls: boolean }[]>`
        SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('se_app', 'se_admin')
        ORDER BY rolname
      `;
      expect(roles).toEqual([
        { rolname: 'se_admin', rolbypassrls: true },
        { rolname: 'se_app', rolbypassrls: false },
      ]);
    } finally {
      await admin.$disconnect();
    }
  });

  it('issues a Supabase-shaped JWT for loginAs and registers FakeGateway', async () => {
    const user = await insertUser('RESELLER');
    const session = loginAs('RESELLER', {
      supabaseId: user.supabaseId,
      resellerId: user.resellerId,
    });
    const claims = jwt.decode(session.token) as jwt.JwtPayload;

    expect(claims.sub).toBe(user.supabaseId);
    expect(claims.aal).toBe('aal1');
    expect(claims.aud).toBe('authenticated');
    expect(claims.iss).toBe(process.env.TEST_JWT_ISS);
    expect(claims.role).toBe('authenticated');

    const { app, gateway } = await createTestApp();
    try {
      expect(gateway).toBeInstanceOf(FakeGateway);
      await gateway.createCharge({
        amountCents: 100,
        idempotencyKey: 'k1',
        description: 'probe',
      });
      expect(gateway.charges).toHaveLength(1);

      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    } finally {
      await app.close();
    }
  });
});
