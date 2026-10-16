import { spawnSync } from 'node:child_process';

process.env.E2E_PUBLICO_PROD = '1';
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['playwright', 'test', 'e2e/fluxo-feliz/publico.spec.ts'],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
