import { resolveHost } from './resolve-host';

describe('resolveHost', () => {
  it('keeps the apex and localhost on the landing', () => {
    expect(resolveHost('sejaengajado.com.br').kind).toBe('landing');
    expect(resolveHost('www.sejaengajado.com.br').kind).toBe('landing');
    expect(resolveHost('localhost:4200').kind).toBe('landing');
    expect(resolveHost('127.0.0.1:4200').kind).toBe('landing');
  });

  it('keeps app. on the panel', () => {
    expect(resolveHost('app.sejaengajado.com.br').kind).toBe('app');
    expect(resolveHost('app.localhost:4200').kind).toBe('app');
  });

  it('extracts a slug from the public host and from *.localhost', () => {
    expect(resolveHost('salao-da-ana.sejaengajado.com.br')).toEqual({
      kind: 'tenant',
      slug: 'salao-da-ana',
    });
    expect(resolveHost('Salao-Da-Ana.localhost:4200')).toEqual({
      kind: 'tenant',
      slug: 'salao-da-ana',
    });
  });

  it('accepts ?tenant= as a dev override', () => {
    expect(resolveHost('localhost:4200', '?tenant=oficina-suspensa')).toEqual({
      kind: 'tenant',
      slug: 'oficina-suspensa',
    });
    expect(resolveHost('localhost:4200', '?tenant=').kind).toBe('landing');
    expect(resolveHost('app.localhost', 'tenant=barbearia-do-ze')).toEqual({
      kind: 'tenant',
      slug: 'barbearia-do-ze',
    });
  });

  it('does not treat a nested host as a tenant', () => {
    expect(resolveHost('a.b.sejaengajado.com.br').kind).toBe('landing');
  });
});
