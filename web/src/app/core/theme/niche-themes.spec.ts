import {
  NICHE_THEMES,
  contrastRatio,
  ensureContrast,
  pickTextColor,
  resolveTheme,
  themeToCssVars,
} from './niche-themes';

describe('niche-themes (FF3)', () => {
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

  it('exposes generico CSS variables including --t-* and legacy --p*', () => {
    const vars = themeToCssVars(NICHE_THEMES.generico);
    expect(vars['--t-primary']).toBe('#1e3a5f');
    expect(vars['--t-on-primary']).toBe('#f4f7f6');
    expect(vars['--p1']).toBe('#1e3a5f');
    expect(vars['--fh']).toContain('Fraunces');
  });

  it('falls back unknown niches to generico tokens', () => {
    const theme = resolveTheme({ theme: { niche: 'barbearia' } });
    expect(theme.colors.primary).toBe(NICHE_THEMES.generico.colors.primary);
    expect(theme.key).toBe('barbearia');
  });

  it('keeps AA on primary pairs of the default theme', () => {
    const t = NICHE_THEMES.generico;
    expect(contrastRatio(t.colors.primary, t.colors.primaryContrast)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.colors.bg, t.colors.text)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.colors.surface, t.colors.text)).toBeGreaterThanOrEqual(4.5);
  });
});
