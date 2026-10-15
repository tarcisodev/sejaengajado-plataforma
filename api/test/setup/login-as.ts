import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import type { UserRole } from '../../src/common/roles';

export interface LoginAsResult {
  token: string;
  sub: string;
  role: UserRole;
  resellerId?: string;
  aal: 'aal1' | 'aal2';
}

/**
 * Builds a Supabase-shaped JWT for the future SupabaseJwtGuard (02-B4).
 * App role and resellerId are not trusted from claims; they stay on this helper
 * return value so tests can seed the matching User row.
 */
export function loginAs(
  role: UserRole,
  options: { resellerId?: string; supabaseId?: string; aal?: 'aal1' | 'aal2' } = {},
): LoginAsResult {
  const secret = process.env.TEST_JWT_SECRET ?? 'test-supabase-jwt-secret';
  const sub = options.supabaseId ?? randomUUID();
  const aal = options.aal ?? (role === 'ADMIN' ? 'aal2' : 'aal1');
  const issuer = process.env.TEST_JWT_ISS ?? 'http://127.0.0.1/auth/v1';
  const audience = process.env.TEST_JWT_AUD ?? 'authenticated';

  const token = jwt.sign(
    {
      role: 'authenticated',
      aal,
      session_id: randomUUID(),
      app_metadata: { provider: 'email' },
      // Deliberately forgeable: the B4 guard must ignore these for authorization.
      user_metadata: { role, resellerId: options.resellerId ?? null },
    },
    secret,
    {
      algorithm: 'HS256',
      subject: sub,
      audience,
      issuer,
      expiresIn: '1h',
    },
  );

  return { token, sub, role, resellerId: options.resellerId, aal };
}
