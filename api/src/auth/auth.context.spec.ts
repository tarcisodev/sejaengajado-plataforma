import {
  AdminPrismaForbiddenError,
  enterAuthUser,
  getAuthUser,
  requireAdminPrismaAccess,
  runWithAuthUser,
} from './auth.context';
import type { AuthUser } from './auth-user';

const adminAal2: AuthUser = {
  id: 'a1',
  supabaseId: 's1',
  email: 'a@example.com',
  role: 'ADMIN',
  resellerId: null,
  status: 'ACTIVE',
  resellerStatus: null,
  aal: 'aal2',
};

const reseller: AuthUser = {
  id: 'r1',
  supabaseId: 's2',
  email: 'r@example.com',
  role: 'RESELLER',
  resellerId: 'res-1',
  status: 'ACTIVE',
  resellerStatus: 'ACTIVE',
  aal: 'aal1',
};

describe('auth.context', () => {
  it('runs and reads auth user from ALS', () => {
    expect(getAuthUser()).toBeUndefined();
    const seen = runWithAuthUser(reseller, () => getAuthUser());
    expect(seen?.id).toBe('r1');
  });

  it('enterAuthUser binds for subsequent getAuthUser in same context', () => {
    runWithAuthUser(adminAal2, () => {
      enterAuthUser(adminAal2);
      expect(getAuthUser()?.aal).toBe('aal2');
    });
  });

  it('requireAdminPrismaAccess allows ADMIN at aal1 or aal2', () => {
    runWithAuthUser(adminAal2, () => {
      expect(requireAdminPrismaAccess().id).toBe('a1');
    });
    runWithAuthUser({ ...adminAal2, aal: 'aal1' }, () => {
      expect(requireAdminPrismaAccess().id).toBe('a1');
    });
    expect(() =>
      runWithAuthUser(reseller, () => requireAdminPrismaAccess()),
    ).toThrow(AdminPrismaForbiddenError);
    expect(() => requireAdminPrismaAccess()).toThrow(AdminPrismaForbiddenError);
  });
});
