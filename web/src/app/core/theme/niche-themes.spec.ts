import {
  NICHE_THEMES,
  NicheThemeKey,
  contrastRatio,
  ensureContrast,
  pickTextColor,
  resolveTheme,
  themeToCssVars,
} from './niche-themes';

const NICHE_KEYS = Object.keys(NICHE_THEMES) as NicheThemeKey[];

describe('niche-themes (LU1+)', () => {
  it('reports black/white contrast as 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('picks light text on dark brand and dark text on light brand', () => {
    expect(pickTextColor('#1e3a5f')).toBe('#f4f7f6');
    expect(pickTextColor('#f4f7f6')).toBe('#102018');
  });

  it('ensures AA contrast when brand fails against text', () => {
    const mid = '#808080';
    const text = '#ffffff';
    const fixed = ensureContrast(mid, text, 4.5);
    expect(contrastRatio(fixed, text)).toBeGreaterThanOrEqual(4.5);
  });

  it('registers all six niche keys', () => {
    const expected: NicheThemeKey[] = [
      'barbearia',
      'beleza',
      'generico',
      'moda',
      'restaurante',
      'saude',
    ];
    expect([...NICHE_KEYS].sort()).toEqual(expected.sort());
  });

  it('keeps AA on text/bg and primary pairs for every niche', () => {
    for (const key of NICHE_KEYS) {
      const t = NICHE_THEMES[key];
      expect(contrastRatio(t.colors.primary, t.colors.primaryContrast))
        .withContext(`${key} primary`)
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.colors.bg, t.colors.text))
        .withContext(`${key} bg/text`)
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.colors.surface, t.colors.text))
        .withContext(`${key} surface/text`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('snapshots CSS variables per niche', () => {
    for (const key of NICHE_KEYS) {
      const vars = themeToCssVars(NICHE_THEMES[key]);
      expect(vars['--t-primary']).toBe(NICHE_THEMES[key].colors.primary);
      expect(vars['--t-on-primary']).toBe(NICHE_THEMES[key].colors.primaryContrast);
      expect(vars['--p1']).toBe(NICHE_THEMES[key].legacy.p1);
      expect(vars['--t-hero']).toContain('linear-gradient');
    }
  });

  it('resolves niche tokens without legacy bridge', () => {
    const theme = resolveTheme({ theme: { niche: 'barbearia' } });
    expect(theme.key).toBe('barbearia');
    expect(theme.colors.primary).toBe(NICHE_THEMES.barbearia.colors.primary);
    expect(theme.colors.primary).not.toBe(NICHE_THEMES.generico.colors.primary);
  });

  it('falls back unknown niches to generico', () => {
    const theme = resolveTheme({ theme: { niche: 'desconhecido' } });
    expect(theme.key).toBe('generico');
    expect(theme.colors.primary).toBe(NICHE_THEMES.generico.colors.primary);
  });
});
