export type AdminSection =
  | 'inicio'
  | 'clientes'
  | 'revendedores'
  | 'atacado'
  | 'sites'
  | 'planos'
  | 'configuracoes'
  | 'placas'
  | 'cupons'
  | 'receita'
  | 'faturas';

const SECTIONS: AdminSection[] = [
  'clientes',
  'revendedores',
  'atacado',
  'sites',
  'planos',
  'configuracoes',
  'placas',
  'cupons',
  'receita',
  'faturas',
];

/** Aceita `/admin/...` (rotas reais) e segmentos legados sem prefixo. */
export function adminSection(pathname: string): AdminSection {
  const parts = pathname.split('/').filter(Boolean);
  const head = parts[0] === 'admin' ? (parts[1] ?? '') : (parts[0] ?? '');
  return SECTIONS.includes(head as AdminSection) ? (head as AdminSection) : 'inicio';
}
