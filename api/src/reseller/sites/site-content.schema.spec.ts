import { defaultSiteContent, siteContentSchema } from './site-content.schema';

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
