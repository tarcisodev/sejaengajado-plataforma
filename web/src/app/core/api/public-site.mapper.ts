import { Site, SiteContent, SiteProfile, SiteTheme } from '../models/domain';

const DEFAULT_THEME: SiteTheme = {
  niche: 'generico',
  p1: '#1e3a5f',
  p2: '#3d5a4c',
  p3: '#d5e2dc',
  on3: '#102018',
  hi: '#f4f7f6',
  fontHeading: 'Fraunces, Palatino, serif',
  fontBody: 'Literata, Georgia, serif',
  fontScale: 1,
  italic: 'normal',
};

function emptySiteContent(slug: string): SiteContent {
  return {
    businessName: slug,
    profile: { nome: slug, cidade: '', uf: '' },
    theme: { ...DEFAULT_THEME },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeProfile(raw: unknown, fallbackName: string): SiteProfile {
  const profile = asRecord(raw) ?? {};
  const text = (key: string): string | undefined => {
    const value = profile[key];
    return typeof value === 'string' ? value : undefined;
  };
  return {
    nome: String(profile['nome'] ?? fallbackName),
    slogan: text('slogan'),
    logoUrl: text('logoUrl'),
    logoAlt: text('logoAlt'),
    coverUrl: text('coverUrl'),
    coverAlt: text('coverAlt'),
    tags: Array.isArray(profile['tags'])
      ? profile['tags'].filter((tag): tag is string => typeof tag === 'string')
      : undefined,
    cidade: String(profile['cidade'] ?? ''),
    uf: String(profile['uf'] ?? ''),
  };
}

function normalizeTheme(raw: unknown): SiteTheme {
  const theme = asRecord(raw) ?? {};
  // Sites novos (wizard) trazem `niche` sem p1/p2: deixa o tema do nicho + brandColor resolver.
  if (typeof theme['niche'] === 'string' && !theme['p1'] && !theme['p2']) {
    return {
      ...theme,
      niche: theme['niche'] as SiteTheme['niche'],
      italic: theme['italic'] === 'italic' ? 'italic' : 'normal',
    } as SiteTheme;
  }
  return {
    ...DEFAULT_THEME,
    ...theme,
    niche:
      typeof theme['niche'] === 'string'
        ? (theme['niche'] as SiteTheme['niche'])
        : DEFAULT_THEME.niche,
    p1: String(theme['p1'] ?? DEFAULT_THEME.p1),
    p2: String(theme['p2'] ?? DEFAULT_THEME.p2),
    p3: String(theme['p3'] ?? DEFAULT_THEME.p3),
    on3: String(theme['on3'] ?? DEFAULT_THEME.on3),
    hi: String(theme['hi'] ?? DEFAULT_THEME.hi),
    fontHeading: String(theme['fontHeading'] ?? DEFAULT_THEME.fontHeading),
    fontBody: String(theme['fontBody'] ?? DEFAULT_THEME.fontBody),
    fontScale:
      typeof theme['fontScale'] === 'number' ? theme['fontScale'] : DEFAULT_THEME.fontScale,
    italic: theme['italic'] === 'italic' ? 'italic' : 'normal',
  };
}

/** Ensure biosite content always has profile/theme — Nest JSON may omit nested keys. */
export function normalizeSiteContent(raw: unknown, slug: string): SiteContent {
  const base = emptySiteContent(slug);
  const content = asRecord(raw);
  if (!content) {
    return base;
  }
  const businessName = String(
    content['businessName'] ?? asRecord(content['profile'])?.['nome'] ?? slug,
  );
  return {
    ...base,
    ...content,
    businessName,
    profile: normalizeProfile(content['profile'], businessName),
    theme: normalizeTheme(content['theme']),
  } as SiteContent;
}

/** Map Nest public by-host JSON → domain Site (SSR + HttpApi). */
export function siteFromPublicBody(body: Record<string, unknown>, slug: string): Site {
  const unavailable = Boolean(body['temporarilyUnavailable']);
  const status = unavailable ? 'SUSPENDED' : ((body['status'] as Site['status']) ?? 'PUBLISHED');
  const resolvedSlug = String(body['slug'] ?? slug);
  return {
    id: String(body['id'] ?? resolvedSlug),
    customerId: String(body['customerId'] ?? ''),
    resellerId: (body['resellerId'] as string | null) ?? null,
    slug: resolvedSlug,
    customDomain: (body['customDomain'] as string | null) ?? null,
    templateId: String(body['templateId'] ?? body['templateKey'] ?? ''),
    schemaType: typeof body['schemaType'] === 'string' ? body['schemaType'] : undefined,
    content: normalizeSiteContent(body['content'], resolvedSlug),
    status,
    planId: String(body['planId'] ?? ''),
    editable: Boolean(body['editable'] ?? false),
    publishedAt: (body['publishedAt'] as string | null) ?? null,
    hostingRenewsAt: (body['hostingRenewsAt'] as string | null) ?? null,
    plaqueFidelityEndsAt: (body['plaqueFidelityEndsAt'] as string | null) ?? null,
  };
}

export function archivedPublicSite(slug: string): Site {
  return {
    id: slug,
    customerId: '',
    resellerId: null,
    slug,
    customDomain: null,
    templateId: '',
    content: emptySiteContent(slug),
    status: 'ARCHIVED',
    planId: '',
    editable: false,
    publishedAt: null,
    hostingRenewsAt: null,
    plaqueFidelityEndsAt: null,
  };
}
