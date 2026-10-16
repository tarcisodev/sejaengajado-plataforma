import type { LegalSlug } from './legal-documents';

export interface LegalNavLink {
  readonly slug: LegalSlug;
  readonly path: `/${LegalSlug}`;
  readonly label: string;
}

/** Footer + aceite: caminhos públicos estáveis. */
export const LEGAL_NAV: readonly LegalNavLink[] = [
  { slug: 'termos', path: '/termos', label: 'Termos de Uso' },
  { slug: 'privacidade', path: '/privacidade', label: 'Privacidade' },
  { slug: 'uso-aceitavel', path: '/uso-aceitavel', label: 'Uso aceitável' },
  { slug: 'cobranca', path: '/cobranca', label: 'Cobrança' },
  { slug: 'contrato-revenda', path: '/contrato-revenda', label: 'Contrato de revenda' },
] as const;
