import type { SiteStatus } from '../models/domain';

/** pt-BR labels for site status enums (keep raw enum in data-* attributes). */
export function siteStatusLabel(status: SiteStatus | string): string {
  switch (status) {
    case 'PUBLISHED':
      return 'Publicado';
    case 'READ_ONLY':
      return 'Só leitura';
    case 'SUSPENDED':
      return 'Suspenso';
    case 'DRAFT':
      return 'Rascunho';
    case 'ARCHIVED':
      return 'Arquivado';
    default:
      return String(status);
  }
}

export function siteStatusBadgeVariant(
  status: SiteStatus | string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PUBLISHED':
      return 'default';
    case 'DRAFT':
      return 'outline';
    case 'READ_ONLY':
      return 'secondary';
    case 'SUSPENDED':
    case 'ARCHIVED':
      return 'destructive';
    default:
      return 'secondary';
  }
}
