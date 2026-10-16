/**
 * Guards seed-demo against accidental production runs.
 * ALLOW_DEMO_SEED=1 bypasses (explicit break-glass only).
 */

export function databaseNameFromUrl(url: string | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }
  try {
    const normalized = url.replace(/^postgres(ql)?:/i, 'http:');
    const parsed = new URL(normalized);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] ?? '');
    return name || null;
  } catch {
    const match = /\/([A-Za-z0-9._-]+)(?:\?|$)/.exec(url);
    return match?.[1] ?? null;
  }
}

/** True when URL points at the production database name `sejaengajado`. */
export function isProdSejaengajadoDatabase(url: string | undefined): boolean {
  return databaseNameFromUrl(url) === 'sejaengajado';
}

/**
 * Throws if demo seed must not run.
 * Aborts when NODE_ENV=production or DATABASE_URL is the prod `sejaengajado` DB,
 * unless ALLOW_DEMO_SEED=1.
 */
export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.ALLOW_DEMO_SEED === '1') {
    return;
  }
  if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
    throw new Error(
      'seed-demo: abortado (NODE_ENV=production). Use seed:showcase em produção, ou ALLOW_DEMO_SEED=1 só em emergência.',
    );
  }
  const url = env.DATABASE_URL ?? env.ADMIN_DATABASE_URL;
  if (isProdSejaengajadoDatabase(url)) {
    throw new Error(
      'seed-demo: abortado (DATABASE_URL aponta para o banco sejaengajado). Use seed:showcase em produção, ou ALLOW_DEMO_SEED=1 só em emergência.',
    );
  }
}
