import { adminSection } from './admin-section';

describe('adminSection', () => {
  it('maps the first path segment to a panel page', () => {
    expect(adminSection('/')).toBe('inicio');
    expect(adminSection('/revendedores')).toBe('revendedores');
    expect(adminSection('/configuracoes')).toBe('configuracoes');
    expect(adminSection('/desconhecida')).toBe('inicio');
  });
});
