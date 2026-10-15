import { readFileSync } from 'node:fs';

import { z } from 'zod';

const fileBacked = [
  'DATABASE_URL',
  'ADMIN_DATABASE_URL',
  'SUPABASE_JWT_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SMTP_URL',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'GOOGLE_PLACES_API_KEY',
  'HC_JOBS_URL',
] as const;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** App role (`se_app`) — subject to FORCE RLS. */
  DATABASE_URL: z.string().min(1),
  /** Admin role (`se_admin`, BYPASSRLS) — audited ADMIN paths only. */
  ADMIN_DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1),
  SUPABASE_JWT_AUD: z.string().min(1).default('authenticated'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SMTP_URL: z.string().min(1).optional(),
  ASAAS_API_KEY: z.string().min(1).optional(),
  ASAAS_WEBHOOK_TOKEN: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  /** Healthchecks.io ping URL for the lifecycle jobs (secret `se_hc_jobs_url`). */
  HC_JOBS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

export const ENV = Symbol('ENV');

export function supabaseIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
}

export function applySecretFiles(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...source };
  for (const key of fileBacked) {
    const filePath = source[`${key}_FILE`];
    if (!filePath) {
      continue;
    }
    next[key] = readFileSync(filePath, 'utf8').trim();
  }
  return next;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(applySecretFiles(source));
  if (!parsed.success) {
    throw new Error('Configuração inválida');
  }
  return parsed.data;
}
