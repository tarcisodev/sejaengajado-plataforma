/** Shapes supported by the public biosite section divider. */
export type DividerShape =
  'reta' | 'ondulada' | 'zigzag' | 'curva' | 'inclinada' | 'nuvem' | 'serrilhada' | 'none';

export const DIVIDER_SHAPES: readonly DividerShape[] = [
  'reta',
  'ondulada',
  'zigzag',
  'curva',
  'inclinada',
  'nuvem',
  'serrilhada',
  'none',
] as const;

/** Fixed SVG viewBox width/height used by all non-reta shapes. */
export const DIVIDER_VIEWBOX = { width: 1200, height: 120 } as const;

/**
 * Pure path generators for section dividers.
 * Coordinates assume viewBox `0 0 1200 120`; fill covers the "from" side (top).
 */
export function dividerPath(shape: DividerShape): string {
  switch (shape) {
    case 'ondulada':
      return 'M0 0 H1200 V60 ' + 'C1000 110 800 10 600 60 C400 110 200 10 0 60 Z';
    case 'zigzag':
      return (
        'M0 0 H1200 V40 ' +
        'L1100 80 L1000 40 L900 80 L800 40 L700 80 L600 40 ' +
        'L500 80 L400 40 L300 80 L200 40 L100 80 L0 40 Z'
      );
    case 'curva':
      return 'M0 0 H1200 V30 Q600 120 0 30 Z';
    case 'inclinada':
      return 'M0 0 H1200 V20 L0 100 Z';
    case 'nuvem':
      return (
        'M0 0 H1200 V50 ' +
        'C1120 50 1100 90 1020 90 C980 110 920 110 880 90 ' +
        'C820 110 760 110 720 90 C660 110 600 110 560 90 ' +
        'C500 110 440 110 400 90 C340 110 280 110 240 90 ' +
        'C180 110 120 110 80 90 C40 90 20 50 0 50 Z'
      );
    case 'serrilhada':
      return (
        'M0 0 H1200 V35 ' +
        'L1150 75 L1100 35 L1050 75 L1000 35 L950 75 L900 35 ' +
        'L850 75 L800 35 L750 75 L700 35 L650 75 L600 35 ' +
        'L550 75 L500 35 L450 75 L400 35 L350 75 L300 35 ' +
        'L250 75 L200 35 L150 75 L100 35 L50 75 L0 35 Z'
      );
    case 'reta':
    case 'none':
      return '';
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}

export function clampDividerHeight(height: number): number {
  if (!Number.isFinite(height)) {
    return 48;
  }
  return Math.min(120, Math.max(16, Math.round(height)));
}
