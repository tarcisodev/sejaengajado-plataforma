import type { SiteContent } from '../models/domain';
import {
  centsToInput,
  normalizeUrl,
  parseBrlToCents,
  productAlt,
  productCents,
  testimonialsOf,
} from './site-content';

describe('site-content helpers (#45)', () => {
  describe('normalizeUrl', () => {
    it('keeps https, mailto, tel and relative paths', () => {
      expect(normalizeUrl('https://loja.com/x')).toBe('https://loja.com/x');
      expect(normalizeUrl('http://loja.com')).toBe('http://loja.com');
      expect(normalizeUrl('mailto:oi@loja.com')).toBe('mailto:oi@loja.com');
      expect(normalizeUrl('tel:+5534999990000')).toBe('tel:+5534999990000');
      expect(normalizeUrl('/cardapio')).toBe('/cardapio');
    });

    it('adds https:// to bare domains and protocol-relative URLs', () => {
      expect(normalizeUrl('  instagram.com/loja ')).toBe('https://instagram.com/loja');
      expect(normalizeUrl('//cdn.loja.com/a.png')).toBe('https://cdn.loja.com/a.png');
      expect(normalizeUrl('localhost:4200')).toBe('https://localhost:4200');
    });

    it('returns empty string for blank and null for dangerous or malformed input', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl(null)).toBe('');
      expect(normalizeUrl(undefined)).toBe('');
      expect(normalizeUrl('javascript:alert(1)')).toBeNull();
      expect(normalizeUrl('JavaScript:alert(1)')).toBeNull();
      expect(normalizeUrl('data:text/html,oi')).toBeNull();
      expect(normalizeUrl('loja com espaco.com')).toBeNull();
    });
  });

  describe('productCents', () => {
    it('prefers precoCentavos and falls back to legacy priceCents', () => {
      expect(productCents({ nome: 'A', precoCentavos: 2990, priceCents: 100 })).toBe(2990);
      expect(productCents({ nome: 'B', priceCents: 1500 })).toBe(1500);
      expect(productCents({ nome: 'C', precoCentavos: 0 })).toBe(0);
    });

    it('returns null when there is no numeric price', () => {
      expect(productCents({ nome: 'D' })).toBeNull();
      expect(productCents({ nome: 'E', precoCentavos: null, precoTexto: 'Sob consulta' })).toBeNull();
      expect(productCents({ nome: 'F', precoCentavos: Number.NaN })).toBeNull();
    });

    it('round-trips with the pt-BR input helpers', () => {
      expect(parseBrlToCents('R$ 1.299,90')).toBe(129990);
      expect(centsToInput(2990)).toBe('29,90');
    });
  });

  describe('productAlt', () => {
    it('uses alt, then legacy fotoAlt, then the product name', () => {
      expect(productAlt({ nome: 'Pão', alt: ' Pão francês ', fotoAlt: 'velho' })).toBe(
        'Pão francês',
      );
      expect(productAlt({ nome: 'Pão', fotoAlt: 'Foto legado' })).toBe('Foto legado');
      expect(productAlt({ nome: ' Bolo ' })).toBe('Bolo');
    });
  });

  describe('testimonialsOf', () => {
    it('reads {nome, texto} and legacy {name, text}, dropping empty texts', () => {
      const content = {
        testimonials: [
          { nome: 'Ana', texto: 'Ótimo atendimento' },
          { name: 'Bia', text: 'Recomendo' },
          { nome: 'Sem texto', texto: '   ' },
          'lixo',
        ],
      } as unknown as SiteContent;
      expect(testimonialsOf(content)).toEqual([
        { name: 'Ana', text: 'Ótimo atendimento' },
        { name: 'Bia', text: 'Recomendo' },
      ]);
    });

    it('returns [] when testimonials are missing or not an array', () => {
      expect(testimonialsOf(null)).toEqual([]);
      expect(testimonialsOf({ testimonials: 'x' } as unknown as SiteContent)).toEqual([]);
    });
  });
});
