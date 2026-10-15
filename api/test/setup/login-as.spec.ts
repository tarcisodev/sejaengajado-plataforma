import jwt from 'jsonwebtoken';

import { loginAs } from './login-as';

describe('loginAs', () => {
  it('signs a Supabase-shaped token with sub and aal', () => {
    process.env.TEST_JWT_SECRET = 'unit-test-secret';
    process.env.TEST_JWT_ISS = 'http://unit.test/auth/v1';
    process.env.TEST_JWT_AUD = 'authenticated';

    const session = loginAs('ADMIN');
    const claims = jwt.verify(session.token, 'unit-test-secret') as jwt.JwtPayload;

    expect(session.aal).toBe('aal2');
    expect(claims.sub).toBe(session.sub);
    expect(claims.aal).toBe('aal2');
    expect(claims.role).toBe('authenticated');
    expect(claims.aud).toBe('authenticated');
    expect(claims.iss).toBe('http://unit.test/auth/v1');
  });
});
