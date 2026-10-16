/**
 * Cria o admin de desenvolvimento no GoTrue local + tabela `users` (role ADMIN).
 * Lê `.env.local` na raiz. Nunca chama auth de produção.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient, UserRole } from '@prisma/client';

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function loadRootEnv(): Record<string, string> {
  const path = join(__dirname, '..', '..', '.env.local');
  if (!existsSync(path)) {
    throw new Error('Falta .env.local — rode: node scripts/dev-auth.mjs init');
  }
  return parseEnv(readFileSync(path, 'utf8'));
}

async function main(): Promise<void> {
  const env = loadRootEnv();
  const base = (env.SUPABASE_URL || 'http://localhost:9999').replace(/\/$/, '');
  if (/sejaengajado\.com\.br/i.test(base)) {
    throw new Error('Recusado: SUPABASE_URL aponta para produção. Use http://localhost:9999');
  }
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente em .env.local');
  }
  const email = (env.DEV_ADMIN_EMAIL || 'tarcisojun@gmail.com').trim().toLowerCase();

  const listUrl = `${base}/auth/v1/admin/users?page=1&per_page=200`;
  const listRes = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });
  if (!listRes.ok) {
    throw new Error(
      `GoTrue admin list falhou (${listRes.status}). Subiu o compose? ${await listRes.text()}`,
    );
  }
  const listBody = (await listRes.json()) as {
    users?: { id: string; email?: string }[];
  };
  let supabaseId = listBody.users?.find((u) => u.email?.toLowerCase() === email)?.id;

  if (!supabaseId) {
    const createRes = await fetch(`${base}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        email_confirm: true,
        app_metadata: { provider: 'email', providers: ['email'] },
      }),
    });
    if (!createRes.ok) {
      throw new Error(`GoTrue create user falhou (${createRes.status}): ${await createRes.text()}`);
    }
    const created = (await createRes.json()) as { id: string };
    supabaseId = created.id;
    console.log(`GoTrue: criado ${email} (${supabaseId})`);
  } else {
    console.log(`GoTrue: já existe ${email} (${supabaseId})`);
  }

  const adminUrl =
    process.env.ADMIN_DATABASE_URL ||
    'postgresql://se_admin:se_admin@127.0.0.1:5432/sejaengajado';
  const prisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await prisma.user.upsert({
      where: { email },
      create: {
        supabaseId,
        email,
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      },
      update: {
        supabaseId,
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      },
    });
    console.log(`users: ${email} → ADMIN (supabase_id=${supabaseId})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
