#!/usr/bin/env node
/**
 * Auth local (GoTrue + Mailpit) — nunca produção.
 *
 *   node scripts/dev-auth.mjs init        # gera JWT secret/keys + se-public-config + api/.env
 *   node scripts/dev-auth.mjs seed-admin  # cria DEV_ADMIN_EMAIL no GoTrue + tabela users (ADMIN)
 */
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = join(root, '.env.local');
const examplePath = join(root, '.env.local.example');

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvLocal() {
  if (!existsSync(envLocalPath)) {
    if (!existsSync(examplePath)) {
      throw new Error('Falta .env.local.example');
    }
    writeFileSync(envLocalPath, readFileSync(examplePath, 'utf8'), 'utf8');
    console.log('Criado .env.local a partir de .env.local.example');
  }
  return parseEnv(readFileSync(envLocalPath, 'utf8'));
}

function writeEnvLocal(vars) {
  const lines = [
    '# Gerado/atualizado por scripts/dev-auth.mjs — FORA do git.',
    '# Nunca use auth.sejaengajado.com.br aqui.',
    '',
    `SUPABASE_JWT_SECRET=${vars.SUPABASE_JWT_SECRET}`,
    `SUPABASE_ANON_KEY=${vars.SUPABASE_ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${vars.SUPABASE_SERVICE_ROLE_KEY}`,
    `SUPABASE_URL=${vars.SUPABASE_URL || 'http://localhost:9999'}`,
    `SUPABASE_JWT_AUD=${vars.SUPABASE_JWT_AUD || 'authenticated'}`,
    `DEV_ADMIN_EMAIL=${vars.DEV_ADMIN_EMAIL || 'tarcisojun@gmail.com'}`,
    '',
  ];
  writeFileSync(envLocalPath, lines.join('\n'), 'utf8');
}

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function signHs256Jwt(payload, secret) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function ensureKeys(env) {
  const next = { ...env };
  if (!next.SUPABASE_URL?.trim()) {
    next.SUPABASE_URL = 'http://localhost:9999';
  }
  if (!next.SUPABASE_JWT_AUD?.trim()) {
    next.SUPABASE_JWT_AUD = 'authenticated';
  }
  if (!next.DEV_ADMIN_EMAIL?.trim()) {
    next.DEV_ADMIN_EMAIL = 'tarcisojun@gmail.com';
  }
  if (!next.SUPABASE_JWT_SECRET?.trim() || next.SUPABASE_JWT_SECRET.length < 32) {
    next.SUPABASE_JWT_SECRET = randomBytes(48).toString('base64url');
    console.log('Gerado SUPABASE_JWT_SECRET (dev only)');
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 365 * 10;
  if (!next.SUPABASE_ANON_KEY?.trim()) {
    next.SUPABASE_ANON_KEY = signHs256Jwt(
      { role: 'anon', iss: 'supabase', iat: now, exp },
      next.SUPABASE_JWT_SECRET,
    );
    console.log('Gerado SUPABASE_ANON_KEY');
  }
  if (!next.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    next.SUPABASE_SERVICE_ROLE_KEY = signHs256Jwt(
      { role: 'service_role', iss: 'supabase', iat: now, exp },
      next.SUPABASE_JWT_SECRET,
    );
    console.log('Gerado SUPABASE_SERVICE_ROLE_KEY');
  }
  return next;
}

function writePublicConfig(env) {
  const target = join(root, 'web', 'public', 'se-public-config.json');
  const body = {
    sentryDsn: null,
    sentryRelease: null,
    supabaseUrl: env.SUPABASE_URL.replace(/\/$/, ''),
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    apiUrl: '/api',
  };
  writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  console.log(`Escrito ${target}`);
}

function writeApiEnv(env) {
  const apiEnvPath = join(root, 'api', '.env');
  const secretsDir = join(root, '.local', 'dev-secrets');
  mkdirSync(secretsDir, { recursive: true });
  const jwtFile = join(secretsDir, 'supabase_jwt_secret');
  const serviceFile = join(secretsDir, 'supabase_service_role_key');
  writeFileSync(jwtFile, env.SUPABASE_JWT_SECRET, 'utf8');
  writeFileSync(serviceFile, env.SUPABASE_SERVICE_ROLE_KEY, 'utf8');

  const content = `# Gerado por scripts/dev-auth.mjs — não commitado.
# Auth LOCAL apenas (GoTrue em localhost:9999). Nunca produção.

NODE_ENV=development
PORT=3000

# Após migrate: use se_app / se_admin. 1ª migrate: superuser postgres (ver docs/DEV.md).
DATABASE_URL=postgresql://se_app:se_app@127.0.0.1:5432/sejaengajado
ADMIN_DATABASE_URL=postgresql://se_admin:se_admin@127.0.0.1:5432/sejaengajado

SUPABASE_URL=${env.SUPABASE_URL.replace(/\/$/, '')}
SUPABASE_JWT_AUD=${env.SUPABASE_JWT_AUD}
SUPABASE_JWT_SECRET_FILE=${jwtFile.replace(/\\/g, '/')}
SUPABASE_SERVICE_ROLE_KEY_FILE=${serviceFile.replace(/\\/g, '/')}

ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
ENABLE_DOCS=true
`;
  writeFileSync(apiEnvPath, content, 'utf8');
  console.log(`Escrito ${apiEnvPath} e secrets em .local/dev-secrets/`);
}

function cmdInit() {
  const env = ensureKeys(loadEnvLocal());
  writeEnvLocal(env);
  writePublicConfig(env);
  writeApiEnv(env);
  console.log(`
OK — init concluído.
Próximos passos: ver docs/DEV.md
  docker compose -f docker-compose.dev.yml --env-file .env.local up -d
  (migrate + seed da API)
  node scripts/dev-auth.mjs seed-admin
`);
}

function cmdSeedAdmin() {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'scripts/seed-dev-admin.ts'],
    { cwd: join(root, 'api'), stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const cmd = process.argv[2] ?? 'init';
if (cmd === 'init') {
  cmdInit();
} else if (cmd === 'seed-admin') {
  cmdSeedAdmin();
} else {
  console.error('Uso: node scripts/dev-auth.mjs [init|seed-admin]');
  process.exit(1);
}
