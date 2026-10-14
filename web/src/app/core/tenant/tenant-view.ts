import { Site } from '../models/domain';

export type TenantView =
  | { kind: 'landing' }
  | { kind: 'app' }
  | { kind: 'site'; site: Site }
  | { kind: 'suspended'; businessName: string }
  | { kind: 'archived'; businessName: string }
  | { kind: 'not-found'; slug: string };

export function viewForSite(site: Site | null, slug: string): TenantView {
  if (!site || site.status === 'DRAFT') {
    return { kind: 'not-found', slug };
  }
  if (site.status === 'SUSPENDED') {
    return { kind: 'suspended', businessName: site.content.businessName };
  }
  if (site.status === 'ARCHIVED') {
    return { kind: 'archived', businessName: site.content.businessName };
  }
  return { kind: 'site', site };
}

export function httpStatusFor(view: TenantView): number {
  if (view.kind === 'not-found') {
    return 404;
  }
  if (view.kind === 'archived') {
    return 410;
  }
  return 200;
}

export function applyHttpStatus(response: ResponseInit | null, view: TenantView): void {
  if (!response) {
    return;
  }
  response.status = httpStatusFor(view);
}

export function titleFor(view: TenantView): string {
  switch (view.kind) {
    case 'landing':
      return 'Seja Engajado | Site e placa de avaliação em Uberaba';
    case 'app':
      return 'Painel · Seja Engajado';
    case 'site':
      return `${view.site.content.businessName} · Seja Engajado`;
    case 'suspended':
      return 'Temporariamente indisponível · Seja Engajado';
    case 'archived':
      return 'Indisponível · Seja Engajado';
    case 'not-found':
      return 'Negócio não encontrado · Seja Engajado';
  }
}
