import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SignJWT } from 'jose';

import { SupabaseJwtGuard } from './supabase-jwt.guard';

const secret = 'test-supabase-jwt-secret';
const supabaseUrl = 'http://127.0.0.1';
const issuer = `${supabaseUrl}/auth/v1`;

async function token(opts: {
  sub: string;
  aal?: string;
  aud?: string;
  iss?: string;
  expOffsetSec?: number;
}) {
  return new SignJWT({ aal: opts.aal ?? 'aal1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.sub)
    .setIssuer(opts.iss ?? issuer)
    .setAudience(opts.aud ?? 'authenticated')
    .setExpirationTime(`${opts.expOffsetSec ?? 3600}s`)
    .sign(new TextEncoder().encode(secret));
}

function ctx(authorization?: string, isPublic = false) {
  const req: { headers: { authorization?: string }; user?: unknown; tenantActor?: unknown } = {
    headers: { authorization },
  };
  return {
    req,
    context: {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as never,
    reflector: {
      getAllAndOverride: jest.fn().mockReturnValue(isPublic),
    },
  };
}

describe('SupabaseJwtGuard', () => {
  const systemPrisma = {
    user: { findUnique: jest.fn() },
    reseller: { findUnique: jest.fn() },
  };
  const env = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_JWT_SECRET: secret,
    SUPABASE_JWT_AUD: 'authenticated',
  };

  beforeEach(() => {
    systemPrisma.user.findUnique.mockReset();
    systemPrisma.reseller.findUnique.mockReset();
  });

  it('allows public routes without token', async () => {
    const { context, reflector } = ctx(undefined, true);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects missing bearer', async () => {
    const { context, reflector } = ctx(undefined, false);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects bad signature / aud / iss', async () => {
    const bad = await token({ sub: 'u1', aud: 'wrong' });
    const { context, reflector } = ctx(`Bearer ${bad}`);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects uninvited user', async () => {
    const jwt = await token({ sub: 'missing' });
    systemPrisma.user.findUnique.mockResolvedValue(null);
    const { context, reflector } = ctx(`Bearer ${jwt}`);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    try {
      await guard.canActivate(context);
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'AUTH_NOT_INVITED',
      });
    }
  });

  it('rejects inactive user', async () => {
    const jwt = await token({ sub: 'u1' });
    systemPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      supabaseId: 'u1',
      email: 'e@x.com',
      role: 'RESELLER',
      resellerId: 'r1',
      status: 'DISABLED',
    });
    const { context, reflector } = ctx(`Bearer ${jwt}`);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts valid invited ACTIVE user and sets aal2', async () => {
    const jwt = await token({ sub: 'u1', aal: 'aal2' });
    systemPrisma.user.findUnique.mockResolvedValue({
      id: '1',
      supabaseId: 'u1',
      email: 'e@x.com',
      role: 'ADMIN',
      resellerId: null,
      status: 'ACTIVE',
    });
    const { context, reflector, req } = ctx(`Bearer ${jwt}`);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ role: 'ADMIN', aal: 'aal2', resellerStatus: null });
    expect(req.tenantActor).toMatchObject({ userId: '1', role: 'ADMIN' });
  });

  it('loads resellerStatus for RESELLER users', async () => {
    const jwt = await token({ sub: 'u2', aal: 'aal1' });
    systemPrisma.user.findUnique.mockResolvedValue({
      id: '2',
      supabaseId: 'u2',
      email: 'r@x.com',
      role: 'RESELLER',
      resellerId: 'res-1',
      status: 'ACTIVE',
    });
    systemPrisma.reseller.findUnique.mockResolvedValue({ status: 'DELINQUENT' });
    const { context, reflector, req } = ctx(`Bearer ${jwt}`);
    const guard = new SupabaseJwtGuard(
      reflector as unknown as Reflector,
      env as never,
      systemPrisma as never,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ role: 'RESELLER', resellerStatus: 'DELINQUENT' });
  });
});
