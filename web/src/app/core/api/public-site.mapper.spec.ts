import { normalizeSiteContent, siteFromPublicBody } from './public-site.mapper';

describe('public-site.mapper', () => {
  it('normalizes content without profile (avoids TypeError on logoUrl/nome)', () => {
    const content = normalizeSiteContent({ businessName: 'Forno da Praça' }, 'demo-forno');
    expect(content.profile.nome).toBe('Forno da Praça');
    expect(content.profile.cidade).toBe('');
    expect(content.profile.logoUrl).toBeUndefined();
    expect(content.theme.p1).toBeTruthy();
  });

  it('maps by-host body with sparse content into a renderable Site', () => {
    const site = siteFromPublicBody(
      {
        status: 'PUBLISHED',
        slug: 'demo-forno',
        content: { businessName: 'Forno da Praça' },
      },
      'demo-forno',
    );
    expect(site.content.profile.nome).toContain('Forno');
    expect(site.content.businessName).toContain('Forno');
  });

  it('keeps existing profile fields when present', () => {
    const site = siteFromPublicBody(
      {
        status: 'PUBLISHED',
        slug: 'demo-barbearia',
        content: {
          businessName: 'Barbearia do Centro',
          profile: { nome: 'Barbearia do Centro', cidade: 'Uberaba', uf: 'MG', logoUrl: '/x.svg' },
        },
      },
      'demo-barbearia',
    );
    expect(site.content.profile.logoUrl).toBe('/x.svg');
    expect(site.content.profile.cidade).toBe('Uberaba');
  });
});
