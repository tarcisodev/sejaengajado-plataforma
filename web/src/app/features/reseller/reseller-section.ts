export type ResellerSection =
  | 'inicio'
  | 'clientes'
  | 'sites'
  | 'vendas'
  | 'extrato'
  | 'faturas';

const SECTIONS: ResellerSection[] = [
  'clientes',
  'sites',
  'vendas',
  'extrato',
  'faturas',
];

export function resellerSection(pathname: string): ResellerSection {
  const parts = pathname.split('/').filter(Boolean);
  const head = parts[0] === 'revenda' ? (parts[1] ?? '') : (parts[0] ?? '');
  return SECTIONS.includes(head as ResellerSection) ? (head as ResellerSection) : 'inicio';
}
