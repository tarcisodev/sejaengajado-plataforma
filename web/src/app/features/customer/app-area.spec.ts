import { appArea } from './app-area';

describe('appArea', () => {
  it('classifies legacy customer vs admin path heads', () => {
    expect(appArea('/entrar')).toBe('customer');
    expect(appArea('/conta')).toBe('customer');
    expect(appArea('/')).toBe('admin');
    expect(appArea('/admin')).toBe('admin');
  });
});
