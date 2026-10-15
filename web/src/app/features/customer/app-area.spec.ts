import { appArea } from './app-area';

describe('appArea', () => {
  it('keeps the customer login off the admin shell', () => {
    expect(appArea('/entrar')).toBe('customer');
    expect(appArea('/conta')).toBe('customer');
    expect(appArea('/')).toBe('admin');
    expect(appArea('/revendedores')).toBe('admin');
  });
});
