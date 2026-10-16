import { searchPlaces } from './places-client';

describe('places-client SSRF', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('always calls the fixed Google Places URL (never a user-supplied host)', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ places: [] }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await searchPlaces('padaria uberaba', 'test-key-from-file');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = call[0];
    const init = call[1];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(url.startsWith('https://places.googleapis.com/')).toBe(true);
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe(
      'test-key-from-file',
    );
    const body = JSON.parse(String(init.body)) as { textQuery: string };
    expect(body.textQuery).toBe('padaria uberaba');
  });
});
