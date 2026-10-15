import { redactSecrets } from './audit.service';

describe('redactSecrets', () => {
  it('redacts nested secret keys', () => {
    expect(redactSecrets({ token: 'x', keep: 1 })).toEqual({
      token: '[Redacted]',
      keep: 1,
    });
  });
});
