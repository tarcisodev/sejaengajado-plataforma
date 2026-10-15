import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadEnv } from './env';

describe('loadEnv', () => {
  it('fails fast when the database url is missing', () => {
    expect(() => loadEnv({})).toThrow('Configuração inválida');
  });

  it('reads a docker secret file into the matching variable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'se-env-'));
    const file = join(dir, 'db');
    writeFileSync(file, 'postgres://local/db\n');

    const env = loadEnv({
      DATABASE_URL_FILE: file,
      ADMIN_DATABASE_URL: 'postgres://local/admin',
      SUPABASE_URL: 'http://127.0.0.1',
      SUPABASE_JWT_SECRET: 'secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    });

    expect(env.DATABASE_URL).toBe('postgres://local/db');
  });

  it('reads the Google Places key from a secret file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'se-env-'));
    const file = join(dir, 'places');
    writeFileSync(file, 'places-key\n');

    const env = loadEnv({
      DATABASE_URL: 'postgres://local/db',
      ADMIN_DATABASE_URL: 'postgres://local/admin',
      SUPABASE_URL: 'http://127.0.0.1',
      SUPABASE_JWT_SECRET: 'secret',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      GOOGLE_PLACES_API_KEY_FILE: file,
    });

    expect(env.GOOGLE_PLACES_API_KEY).toBe('places-key');
  });

  it('loads supabase auth secrets from files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'se-env-'));
    const jwtFile = join(dir, 'jwt');
    const serviceFile = join(dir, 'service');
    writeFileSync(jwtFile, 'jwt-secret\n');
    writeFileSync(serviceFile, 'service-role\n');

    const env = loadEnv({
      DATABASE_URL: 'postgres://local/db',
      ADMIN_DATABASE_URL: 'postgres://local/admin',
      SUPABASE_URL: 'http://127.0.0.1',
      SUPABASE_JWT_SECRET_FILE: jwtFile,
      SUPABASE_SERVICE_ROLE_KEY_FILE: serviceFile,
    });

    expect(env.SUPABASE_JWT_SECRET).toBe('jwt-secret');
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('service-role');
    expect(env.SUPABASE_JWT_AUD).toBe('authenticated');
  });

  it('does not open a listener when config is invalid', async () => {
    const { boot } = await import('../main');
    const listen = jest.fn();

    await expect(boot({}, listen)).rejects.toThrow('Configuração inválida');
    expect(listen).not.toHaveBeenCalled();
  });
});
