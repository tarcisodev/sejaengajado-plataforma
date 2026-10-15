export type AdminSection =
  | 'inicio'
  | 'clientes'
  | 'revendedores'
  | 'sites'
  | 'planos'
  | 'configuracoes'
  | 'cupons'
  | 'receita'
  | 'faturas';

const SECTIONS: AdminSection[] = [
  'clientes',
  'revendedores',
  'sites',
  'planos',
  'configuracoes',
  'cupons',
  'receita',
  'faturas',
];

export function adminSection(pathname: string): AdminSection {
  const head = pathname.split('/').filter(Boolean)[0] ?? '';
  return SECTIONS.includes(head as AdminSection) ? (head as AdminSection) : 'inicio';
}
