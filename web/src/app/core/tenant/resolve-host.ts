export type HostDecision = { kind: 'landing' } | { kind: 'app' } | { kind: 'tenant'; slug: string };

const APEX_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'sejaengajado.com.br',
  'www.sejaengajado.com.br',
]);
const APEX_SUFFIX = '.sejaengajado.com.br';
const LOCAL_SUFFIX = '.localhost';

/** Dev override `?tenant=slug` wins over the host. Apex and `app.` stay on the platform. */
export function resolveHost(hostHeader: string, search = ''): HostDecision {
  const tenant = readTenantQuery(search);
  if (tenant) {
    return { kind: 'tenant', slug: tenant };
  }

  const host = hostnameOf(hostHeader);
  if (!host || APEX_HOSTS.has(host)) {
    return { kind: 'landing' };
  }
  if (host === 'app' || host.startsWith('app.')) {
    return { kind: 'app' };
  }

  const slug = slugFromHost(host);
  if (!slug) {
    return { kind: 'landing' };
  }
  return { kind: 'tenant', slug };
}

export function hostFromLocation(location: { hostname: string; port: string }): string {
  return location.port ? `${location.hostname}:${location.port}` : location.hostname;
}

function readTenantQuery(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const tenant = new URLSearchParams(raw).get('tenant')?.trim().toLowerCase() ?? '';
  return tenant || null;
}

function hostnameOf(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase().replace(/\.$/, '');
  if (trimmed.startsWith('[')) {
    return trimmed;
  }
  return trimmed.replace(/:\d+$/, '');
}

function slugFromHost(host: string): string | null {
  const suffix = host.endsWith(LOCAL_SUFFIX)
    ? LOCAL_SUFFIX
    : host.endsWith(APEX_SUFFIX)
      ? APEX_SUFFIX
      : null;
  if (!suffix) {
    return null;
  }
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes('.')) {
    return null;
  }
  return slug;
}
