import { siteStatusBadgeVariant, siteStatusLabel } from './site-status-label';

describe('siteStatusLabel', () => {
  it('maps enums to pt-BR labels', () => {
    expect(siteStatusLabel('PUBLISHED')).toBe('Publicado');
    expect(siteStatusLabel('READ_ONLY')).toBe('Só leitura');
    expect(siteStatusLabel('SUSPENDED')).toBe('Suspenso');
    expect(siteStatusLabel('DRAFT')).toBe('Rascunho');
    expect(siteStatusLabel('ARCHIVED')).toBe('Arquivado');
  });

  it('uses destructive badge for suspended and archived', () => {
    expect(siteStatusBadgeVariant('SUSPENDED')).toBe('destructive');
    expect(siteStatusBadgeVariant('ARCHIVED')).toBe('destructive');
    expect(siteStatusBadgeVariant('PUBLISHED')).toBe('default');
  });
});
