export type AdminSection =
  | 'inicio'
  | 'clientes'
  | 'revendedores'
  | 'sites'
  | 'planos'
  | 'configuracoes'
  | 'cupons'
  | 'receita';

const SECTIONS: AdminSection[] = [
  'clientes',
  'revendedores',
  'sites',
  'planos',
  'configuracoes',
  'cupons',
  'receita',
];

export function adminSection(pathname: string): AdminSection {
  const head = pathname.split('/').filter(Boolean)[0] ?? '';
  return SECTIONS.includes(head as AdminSection) ? (head as AdminSection) : 'inicio';
}
