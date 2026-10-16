/** Niche theme tokens for the public biosite (no spartan/helm). */

export type NicheThemeKey = 'barbearia' | 'restaurante' | 'moda' | 'beleza' | 'saude' | 'generico';

export interface NicheTheme {
  key: NicheThemeKey;
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    primaryContrast: string;
    accent: string;
    border: string;
  };
  gradients: { hero: string; cta: string };
  fonts: { heading: string; body: string };
  radius: { sm: string; md: string; lg: string; pill: string };
  shadows: { sm: string; md: string; lg: string };
  spacing: { sectionY: string; gap: string; container: string };
  motion: { duration: string; easing: string };
  /** Legacy SiteTheme bridge (p1/p2/…). */
  legacy: {
    p1: string;
    p2: string;
    p3: string;
    on3: string;
    hi: string;
    fontHeading: string;
    fontBody: string;
    fontScale: number;
    italic: 'normal' | 'italic';
  };
}

/** FF3: one excellent default; other keys resolve to this until LU1+. */
export const NICHE_THEMES: Record<'generico', NicheTheme> = {
  generico: {
    key: 'generico',
    colors: {
      bg: '#f4f7f6',
      surface: '#ffffff',
      text: '#102018',
      muted: '#4a5c54',
      primary: '#1e3a5f',
      primaryContrast: '#f4f7f6',
      accent: '#3d5a4c',
      border: 'rgba(16, 32, 24, 0.14)',
    },
    gradients: {
      hero: 'linear-gradient(120deg, #1e3a5f, #3d5a4c)',
      cta: 'linear-gradient(120deg, #1e3a5f, #3d5a4c)',
    },
    fonts: {
      heading: 'Fraunces, Palatino, Georgia, serif',
      body: 'Literata, Georgia, serif',
    },
    radius: { sm: '0.5rem', md: '1rem', lg: '1.25rem', pill: '999px' },
    shadows: {
      sm: '0 4px 12px rgba(16, 32, 24, 0.08)',
      md: '0 8px 20px rgba(16, 32, 24, 0.1)',
      lg: '0 16px 36px rgba(16, 32, 24, 0.14)',
    },
    spacing: { sectionY: '1.5rem', gap: '0.75rem', container: '30rem' },
    motion: { duration: '220ms', easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    legacy: {
      p1: '#1e3a5f',
      p2: '#3d5a4c',
      p3: '#d5e2dc',
      on3: '#102018',
      hi: '#f4f7f6',
      fontHeading: 'Fraunces, Palatino, Georgia, serif',
      fontBody: 'Literata, Georgia, serif',
      fontScale: 1,
      italic: 'normal',
    },
  },
};

export function isNicheThemeKey(value: string): value is NicheThemeKey {
  return (
    value === 'barbearia' ||
    value === 'restaurante' ||
    value === 'moda' ||
    value === 'beleza' ||
    value === 'saude' ||
    value === 'generico'
  );
}

export function resolveNicheKey(raw: unknown): NicheThemeKey {
  if (typeof raw === 'string' && isNicheThemeKey(raw)) {
    return raw;
  }
  return 'generico';
}

export function resolveTheme(content: {
  theme?: {
    niche?: unknown;
    brandColor?: string;
    p1?: string;
    p2?: string;
    p3?: string;
    on3?: string;
    hi?: string;
    fontHeading?: string;
    fontBody?: string;
    fontScale?: number;
    italic?: 'normal' | 'italic';
  };
}): NicheTheme {
  const key = resolveNicheKey(content.theme?.niche);
  const base = NICHE_THEMES.generico;
  const legacyIn = content.theme;
  const italic: 'normal' | 'italic' = legacyIn?.italic === 'italic' ? 'italic' : 'normal';
  const fromLegacy: NicheTheme =
    legacyIn?.p1 && legacyIn.p2
      ? {
          ...base,
          key,
          colors: {
            ...base.colors,
            primary: legacyIn.p1,
            primaryContrast: legacyIn.hi ?? base.colors.primaryContrast,
            accent: legacyIn.p2,
            text: legacyIn.on3 ?? base.colors.text,
            bg: legacyIn.hi ?? base.colors.bg,
          },
          gradients: {
            hero: `linear-gradient(120deg, ${legacyIn.p1}, ${legacyIn.p2})`,
            cta: `linear-gradient(120deg, ${legacyIn.p1}, ${legacyIn.p2})`,
          },
          fonts: {
            heading: legacyIn.fontHeading ?? base.fonts.heading,
            body: legacyIn.fontBody ?? base.fonts.body,
          },
          legacy: {
            p1: legacyIn.p1,
            p2: legacyIn.p2,
            p3: legacyIn.p3 ?? base.legacy.p3,
            on3: legacyIn.on3 ?? base.legacy.on3,
            hi: legacyIn.hi ?? base.legacy.hi,
            fontHeading: legacyIn.fontHeading ?? base.legacy.fontHeading,
            fontBody: legacyIn.fontBody ?? base.legacy.fontBody,
            fontScale: legacyIn.fontScale ?? 1,
            italic,
          },
        }
      : { ...base, key };

  const brand = content.theme?.brandColor;
  if (!brand || !/^#[0-9a-fA-F]{6}$/.test(brand)) {
    return fromLegacy;
  }
  const textOnBrand = pickTextColor(brand);
  const primaryForText =
    contrastRatio(brand, textOnBrand) >= 4.5 ? brand : ensureContrast(brand, textOnBrand, 4.5);
  return {
    ...fromLegacy,
    colors: {
      ...fromLegacy.colors,
      primary: brand,
      primaryContrast: textOnBrand,
      accent: primaryForText,
    },
    gradients: {
      hero: `linear-gradient(120deg, ${brand}, ${fromLegacy.colors.accent})`,
      cta: `linear-gradient(120deg, ${brand}, ${fromLegacy.colors.accent})`,
    },
    legacy: {
      ...fromLegacy.legacy,
      p1: brand,
      hi: textOnBrand,
    },
  };
}

export function themeToCssVars(theme: NicheTheme): Record<string, string> {
  return {
    '--t-bg': theme.colors.bg,
    '--t-surface': theme.colors.surface,
    '--t-text': theme.colors.text,
    '--t-muted': theme.colors.muted,
    '--t-primary': theme.colors.primary,
    '--t-on-primary': theme.colors.primaryContrast,
    '--t-accent': theme.colors.accent,
    '--t-border': theme.colors.border,
    '--t-hero': theme.gradients.hero,
    '--t-cta': theme.gradients.cta,
    '--t-font-heading': theme.fonts.heading,
    '--t-font-body': theme.fonts.body,
    '--t-radius-sm': theme.radius.sm,
    '--t-radius-md': theme.radius.md,
    '--t-radius-lg': theme.radius.lg,
    '--t-radius-pill': theme.radius.pill,
    '--t-shadow-sm': theme.shadows.sm,
    '--t-shadow-md': theme.shadows.md,
    '--t-shadow-lg': theme.shadows.lg,
    '--t-section-y': theme.spacing.sectionY,
    '--t-gap': theme.spacing.gap,
    '--t-container': theme.spacing.container,
    '--t-motion-duration': theme.motion.duration,
    '--t-motion-easing': theme.motion.easing,
    '--p1': theme.legacy.p1,
    '--p2': theme.legacy.p2,
    '--p3': theme.legacy.p3,
    '--on3': theme.legacy.on3,
    '--hi': theme.legacy.hi,
    '--fh': theme.legacy.fontHeading,
    '--fb': theme.legacy.fontBody,
    '--fs': String(theme.legacy.fontScale),
    '--fi': theme.legacy.italic,
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickTextColor(bg: string): string {
  const light = '#f4f7f6';
  const dark = '#102018';
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

/** Darken/lighten brand until contrast vs text reaches `min` (WCAG AA default 4.5). */
export function ensureContrast(bg: string, text: string, min = 4.5): string {
  let current = bg;
  if (contrastRatio(current, text) >= min) {
    return current;
  }
  const towardDark = relativeLuminance(text) > 0.5;
  for (let i = 0; i < 24; i++) {
    current = towardDark ? shadeHex(current, -0.08) : shadeHex(current, 0.08);
    if (contrastRatio(current, text) >= min) {
      return current;
    }
  }
  return towardDark ? '#102018' : '#f4f7f6';
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '');
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function shadeHex(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const adj = (channel: number) => Math.max(0, Math.min(255, Math.round(channel + amount * 255)));
  return `#${[adj(r), adj(g), adj(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
