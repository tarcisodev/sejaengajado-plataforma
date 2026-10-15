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

    const env = loadEnv({ DATABASE_URL_FILE: file });

    expect(env.DATABASE_URL).toBe('postgres://local/db');
  });

  it('does not open a listener when config is invalid', async () => {
    const { boot } = await import('../main');
    const listen = jest.fn();

    await expect(boot({}, listen)).rejects.toThrow('Configuração inválida');
    expect(listen).not.toHaveBeenCalled();
  });
});
