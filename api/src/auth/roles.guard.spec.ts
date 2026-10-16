import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import type { AuthUser } from './auth-user';

function ctx(user?: AuthUser) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
  });

  it('allows when no roles metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('forbids missing user', () => {
    reflector.getAllAndOverride.mockReturnValue(['RESELLER']);
    expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
  });

  it('forbids wrong role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() =>
      guard.canActivate(
        ctx({
          id: '1',
          supabaseId: 's',
          email: 'e',
          role: 'RESELLER',
          resellerId: 'r',
          status: 'ACTIVE',
          resellerStatus: 'ACTIVE',
          aal: 'aal2',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires aal2 for ADMIN-only routes', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    try {
      guard.canActivate(
        ctx({
          id: '1',
          supabaseId: 's',
          email: 'e',
          role: 'ADMIN',
          resellerId: null,
          status: 'ACTIVE',
          resellerStatus: null,
          aal: 'aal1',
        }),
      );
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'AUTH_MFA_REQUIRED',
      });
    }
  });

  it('allows ADMIN with aal2', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(
      guard.canActivate(
        ctx({
          id: '1',
          supabaseId: 's',
          email: 'e',
          role: 'ADMIN',
          resellerId: null,
          status: 'ACTIVE',
          resellerStatus: null,
          aal: 'aal2',
        }),
      ),
    ).toBe(true);
  });

  it('allows RESELLER on reseller routes without aal2', () => {
    reflector.getAllAndOverride.mockReturnValue(['RESELLER']);
    expect(
      guard.canActivate(
        ctx({
          id: '1',
          supabaseId: 's',
          email: 'e',
          role: 'RESELLER',
          resellerId: 'r',
          status: 'ACTIVE',
          resellerStatus: 'ACTIVE',
          aal: 'aal1',
        }),
      ),
    ).toBe(true);
  });
});
