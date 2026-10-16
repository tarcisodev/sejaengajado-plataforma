import { defaultSiteContent, safeUrl, siteContentSchema } from './site-content.schema';

describe('siteContentSchema', () => {
  it('accepts a valid theme/sections/strip payload', () => {
    const parsed = siteContentSchema.parse({
      theme: { niche: 'barbearia', brandColor: '#112233' },
      sections: [
        {
          type: 'hero',
          divisor: { shape: 'ondulada', height: 48, flip: false, invert: false },
        },
      ],
      strip: { enabled: true, motif: 'tesoura', speed: 'normal', direction: 'left' },
      catalog: { layout: 'grid' },
      rating: null,
      timezone: 'America/Sao_Paulo',
    });
    expect(parsed.theme.niche).toBe('barbearia');
    expect(parsed.catalog.layout).toBe('grid');
  });

  it('rejects invalid brandColor', () => {
    const result = siteContentSchema.safeParse({
      theme: { niche: 'generico', brandColor: 'red' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('brandColor'))).toBe(true);
    }
  });

  it('defaults catalog layout to grid', () => {
    expect(defaultSiteContent().catalog.layout).toBe('grid');
  });

  it('accepts lumen divider shapes', () => {
    for (const shape of ['zigzag', 'curva', 'nuvem', 'serrilhada', 'inclinada'] as const) {
      const parsed = siteContentSchema.parse({
        theme: { niche: 'generico' },
        sections: [{ type: 'hero', divisor: { shape, height: 48 } }],
      });
      expect(parsed.sections[0]?.divisor?.shape).toBe(shape);
    }
  });
});

describe('safeUrl', () => {
  const ok = (v: string) => safeUrl.safeParse(v);

  it('prefixes https:// on bare domains (legacy content)', () => {
    expect(ok('wa.me/5534999999999').data).toBe('https://wa.me/5534999999999');
    expect(ok(' instagram.com/x ').data).toBe('https://instagram.com/x');
    expect(ok('www.loja.com.br').data).toBe('https://www.loja.com.br');
    expect(ok('loja.com.br:8080/a?b=1').data).toBe('https://loja.com.br:8080/a?b=1');
  });

  it('keeps valid schemes, relative paths and empty untouched', () => {
    expect(ok('https://x.com').data).toBe('https://x.com');
    expect(ok('mailto:a@b.co').data).toBe('mailto:a@b.co');
    expect(ok('tel:+5534999').data).toBe('tel:+5534999');
    expect(ok('/uploads/a.png').data).toBe('/uploads/a.png');
    expect(ok('').data).toBe('');
  });

  it('still rejects unsafe values', () => {
    for (const v of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      '//evil.com',
      '/\\evil.com',
      'java\tscript:alert(1)',
      '\u0001javascript:alert(1)',
      'loja com.br',
      'semdominio',
    ]) {
      expect(ok(v).success).toBe(false);
    }
  });
});
