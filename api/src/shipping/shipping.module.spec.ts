import type { Env } from '../config/env';
import { FakeShippingProvider } from './fake-shipping.provider';
import { MelhorEnvioProvider } from './melhor-envio.provider';
import { resolveShippingProvider } from './shipping.module';

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'development',
    PORT: 3000,
    DATABASE_URL: 'postgres://local/db',
    ADMIN_DATABASE_URL: 'postgres://local/admin',
    SUPABASE_URL: 'http://127.0.0.1',
    SUPABASE_JWT_SECRET: 'secret',
    SUPABASE_JWT_AUD: 'authenticated',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    ENABLE_DOCS: false,
    ...overrides,
  };
}

describe('resolveShippingProvider', () => {
  it('uses Melhor Envio when token is present', () => {
    const provider = resolveShippingProvider(
      baseEnv({
        MELHORENVIO_TOKEN: 'token',
        MELHORENVIO_BASE_URL: 'https://sandbox.melhorenvio.com.br',
      }),
      new FakeShippingProvider(),
    );
    expect(provider).toBeInstanceOf(MelhorEnvioProvider);
    expect(provider.code).toBe('melhorenvio');
  });

  it('uses fake in non-production without token', () => {
    const fake = new FakeShippingProvider();
    expect(resolveShippingProvider(baseEnv(), fake)).toBe(fake);
  });

  it('refuses fake in production without token', () => {
    expect(() =>
      resolveShippingProvider(baseEnv({ NODE_ENV: 'production' }), new FakeShippingProvider()),
    ).toThrow(/FakeShipping proibido em produção/);
  });
});
