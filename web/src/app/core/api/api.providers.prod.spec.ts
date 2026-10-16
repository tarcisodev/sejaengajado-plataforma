import { httpApiProviders } from './api.providers.http';
import { mockApiProviders } from './api.providers.mock';

describe('API providers (NO-MOCK prod)', () => {
  it('production http providers never include MockApiService', () => {
    const serialized = JSON.stringify(
      httpApiProviders.map((p) => ('useClass' in p ? String(p.useClass) : String(p))),
    );
    expect(serialized).not.toMatch(/MockApi/i);
    expect(httpApiProviders).not.toEqual(mockApiProviders);
  });

  it('mock providers are isolated for tests/dev only', () => {
    const serialized = JSON.stringify(
      mockApiProviders.map((p) => ('provide' in p ? String(p.provide) : String(p))),
    );
    expect(serialized).toMatch(/API_PORT/);
  });
});
