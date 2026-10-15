import { tokensMatch } from './timing-safe-token';

describe('tokensMatch', () => {
  it('accepts equal tokens', () => {
    expect(tokensMatch('secret-token', 'secret-token')).toBe(true);
  });

  it('rejects wrong token and missing values', () => {
    expect(tokensMatch('wrong', 'secret-token')).toBe(false);
    expect(tokensMatch(undefined, 'secret-token')).toBe(false);
    expect(tokensMatch('secret-token', undefined)).toBe(false);
    expect(tokensMatch('short', 'longer-secret')).toBe(false);
  });
});
