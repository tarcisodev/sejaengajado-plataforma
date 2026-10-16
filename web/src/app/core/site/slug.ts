/**
 * Regras de slug compartilhadas no front (espelha `SLUG_REGEX` de
 * api/src/reseller/sites/slug.ts): 3–31 caracteres, minúsculas/números com hífens opcionais.
 */
export const SLUG_REGEX = /^[a-z0-9](-?[a-z0-9]){2,30}$/;

export type SlugCheckState = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

export function isValidSlug(value: string): boolean {
  return SLUG_REGEX.test(value);
}

/** Estados em que o slug não pode ser salvo (inclui `checking`, ainda sem resposta). */
export function isSlugBlocked(state: SlugCheckState): boolean {
  return state === 'checking' || state === 'unavailable' || state === 'invalid';
}

/** Texto do hint exibido abaixo do campo de endereço. */
export function slugHintText(state: SlugCheckState): string {
  switch (state) {
    case 'checking':
      return 'Verificando disponibilidade…';
    case 'available':
      return 'Endereço disponível.';
    case 'unavailable':
      return 'Endereço indisponível. Tente outro.';
    case 'invalid':
      return 'Use de 3 a 31 letras minúsculas, números ou hífen.';
    default:
      return '';
  }
}
