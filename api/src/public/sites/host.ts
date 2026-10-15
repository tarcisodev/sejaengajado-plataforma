import { BRAND_BLOCKLIST } from '../../reseller/sites/slug';

const PLATFORM_SUFFIXES = ['sejaengajado.com.br', 'localhost'] as const;

/** Labels that must never resolve to a tenant (apex / platform hosts). */
const BLOCKED_LABELS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'login',
  'static',
  'cdn',
  'img',
  'status',
  ...BRAND_BLOCKLIST,
]);

/**
 * Extract tenant slug from Host. Returns null for apex, reserved or malformed.
 * Accepts port and mixed case; supports `*.sejaengajado.com.br` and `*.localhost`.
 */
export function parseTenantSlugFromHost(rawHost: string | undefined): string | null {
  if (!rawHost) {
    return null;
  }
  const host = rawHost.trim().toLowerCase().split(':')[0] ?? '';
  if (!host) {
    return null;
  }

  for (const suffix of PLATFORM_SUFFIXES) {
    if (host === suffix) {
      return null;
    }
    const trail = `.${suffix}`;
    if (!host.endsWith(trail)) {
      continue;
    }
    const sub = host.slice(0, -trail.length);
    if (!sub || sub.includes('.')) {
      return null;
    }
    if (BLOCKED_LABELS.has(sub)) {
      return null;
    }
    return sub;
  }

  return null;
}
