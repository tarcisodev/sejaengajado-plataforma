import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { getHarnessPostgres } from '../setup/postgres';

describe('seed', () => {
  it('can run twice without duplicating rows', async () => {
    const { adminUrl, adminPrisma } = getHarnessPostgres();
    const cwd = join(__dirname, '../..');
    const env = {
      ...process.env,
      DATABASE_URL: adminUrl,
      SEED_ADMIN_EMAIL: 'seed-admin@example.com',
      SEED_ADMIN_SUPABASE_ID: '00000000-0000-4000-8000-000000000098',
    };

    execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'inherit' });
    execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'inherit' });

    expect(await adminPrisma.reseller.count({ where: { isPlatform: true } })).toBe(1);
    expect(await adminPrisma.product.count()).toBe(5);
    expect(await adminPrisma.user.count({ where: { email: 'seed-admin@example.com' } })).toBe(1);
    expect(await adminPrisma.reservedSlug.count()).toBeGreaterThanOrEqual(10);
    expect(await adminPrisma.platformConfig.count()).toBe(1);
  });
});
