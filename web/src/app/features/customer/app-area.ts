export function appArea(pathname: string): 'customer' | 'admin' {
  const head = pathname.split('/').filter(Boolean)[0] ?? '';
  return head === 'entrar' || head === 'conta' ? 'customer' : 'admin';
}
