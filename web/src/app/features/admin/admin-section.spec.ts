import { adminSection } from './admin-section';

describe('adminSection', () => {
  it('maps /admin path segments to a panel page', () => {
    expect(adminSection('/admin')).toBe('inicio');
    expect(adminSection('/admin/revendedores')).toBe('revendedores');
    expect(adminSection('/admin/atacado')).toBe('atacado');
    expect(adminSection('/admin/placas')).toBe('placas');
    expect(adminSection('/admin/configuracoes')).toBe('configuracoes');
    expect(adminSection('/admin/desconhecida')).toBe('inicio');
  });

  it('still accepts legacy paths without the /admin prefix', () => {
    expect(adminSection('/revendedores')).toBe('revendedores');
  });
});
