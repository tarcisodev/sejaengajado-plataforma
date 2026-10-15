import { parseTenantSlugFromHost } from './host';

describe('parseTenantSlugFromHost', () => {
  it('parses slug with port and mixed case', () => {
    expect(parseTenantSlugFromHost('Teste.SejaEngajado.com.br:443')).toBe('teste');
  });

  it('rejects apex, app and other reserved labels', () => {
    expect(parseTenantSlugFromHost('sejaengajado.com.br')).toBeNull();
    expect(parseTenantSlugFromHost('app.sejaengajado.com.br')).toBeNull();
    expect(parseTenantSlugFromHost('www.sejaengajado.com.br')).toBeNull();
    expect(parseTenantSlugFromHost('api.sejaengajado.com.br')).toBeNull();
  });

  it('accepts localhost tenants in dev', () => {
    expect(parseTenantSlugFromHost('loja.localhost:4200')).toBe('loja');
    expect(parseTenantSlugFromHost('localhost')).toBeNull();
  });
});
