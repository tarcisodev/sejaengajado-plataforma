import { Site, SiteContent } from '../models/domain';

function emptySiteContent(slug: string): SiteContent {
  return {
    businessName: slug,
    profile: { nome: slug, cidade: '', uf: '' },
    theme: {
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
    },
  };
}

/** Map Nest public by-host JSON → domain Site (SSR + HttpApi). */
export function siteFromPublicBody(body: Record<string, unknown>, slug: string): Site {
  const unavailable = Boolean(body['temporarilyUnavailable']);
  const status = unavailable ? 'SUSPENDED' : ((body['status'] as Site['status']) ?? 'PUBLISHED');
  return {
    id: String(body['id'] ?? slug),
    customerId: String(body['customerId'] ?? ''),
    resellerId: (body['resellerId'] as string | null) ?? null,
    slug: String(body['slug'] ?? slug),
    customDomain: (body['customDomain'] as string | null) ?? null,
    templateId: String(body['templateId'] ?? body['templateKey'] ?? ''),
    schemaType: typeof body['schemaType'] === 'string' ? body['schemaType'] : undefined,
    content: (body['content'] as Site['content']) ?? emptySiteContent(slug),
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
