import { SiteContent } from '../../core/models/domain';
import { aboutText, countdownParts, siteJsonLd, whatsappHref } from './site-seo';

describe('site seo helpers', () => {
  const content: SiteContent = {
    businessName: 'Barbearia do Zé',
    profile: { nome: 'Barbearia do Zé', cidade: 'Uberaba', uf: 'MG', slogan: 'Corte no centro' },
    theme: {
      p1: '#161410',
      p2: '#8c3a2f',
      p3: '#e6d3a3',
      on3: '#161410',
      hi: '#f6f1e7',
      fontHeading: 'Fraunces, serif',
      fontBody: 'Literata, serif',
      fontScale: 1,
      italic: 'normal',
    },
    products: [{ nome: 'Corte', precoTexto: 'R$ 40,00' }],
    seo: { ogImageUrl: 'https://sejaengajado.com.br/og.svg' },
  };

  it('rounds the countdown down to whole units', () => {
    const parts = countdownParts(
      '2027-06-01T23:59:00-03:00',
      new Date('2027-05-31T21:59:00-03:00'),
    );

    expect(parts).toEqual({ d: '1', h: '02', m: '00', s: '00' });
    expect(countdownParts('2020-01-01T00:00:00Z', new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });

  it('writes the local about line and a HairSalon graph', () => {
    expect(aboutText(content)).toContain('Corte');
    expect(aboutText(content)).toContain('Uberaba');

    const graph = siteJsonLd(content, 'barbearia-do-ze', 'HairSalon');
    expect(graph).toContain('HairSalon');
    expect(graph).toContain('BreadcrumbList');
    expect(graph).toContain('https://barbearia-do-ze.sejaengajado.com.br/');
    expect(graph).not.toContain('data:');
  });

  it('builds a WhatsApp link from digits', () => {
    expect(whatsappHref('(34) 99999-0001', 'Olá')).toBe('https://wa.me/34999990001?text=Ol%C3%A1');
  });
});
