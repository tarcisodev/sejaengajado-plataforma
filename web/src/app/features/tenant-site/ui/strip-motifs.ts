/** Motifs for the optional animated strip on the public biosite. */
export type StripMotif =
  'pizza' | 'tesoura' | 'circulos' | 'estrelas' | 'agulha' | 'coracao' | 'none';

export const STRIP_MOTIFS: readonly StripMotif[] = [
  'pizza',
  'tesoura',
  'circulos',
  'estrelas',
  'agulha',
  'coracao',
] as const;

export type StripDirection = 'left' | 'right';
export type StripSpeedPreset = 'slow' | 'normal' | 'fast';

/** Seconds per loop for API speed presets. */
export function stripSpeedSeconds(speed: number | StripSpeedPreset | undefined): number {
  if (typeof speed === 'number' && Number.isFinite(speed) && speed > 0) {
    return speed;
  }
  switch (speed) {
    case 'slow':
      return 36;
    case 'fast':
      return 12;
    case 'normal':
    default:
      return 22;
  }
}
