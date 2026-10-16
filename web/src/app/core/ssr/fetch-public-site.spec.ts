import { ByHostMemoryCache } from './by-host-cache';
import { classifyPublicSite, fetchPublicSiteByHost } from './fetch-public-site';

describe('fetch-public-site (FF3 SSR)', () => {
  it('classifies suspended, archived and not-found', () => {
    expect(
      classifyPublicSite(200, {
        status: 'SUSPENDED',
        temporarilyUnavailable: true,
        slug: 'x',
      }).kind,
    ).toBe('suspended');
    expect(classifyPublicSite(410, null).kind).toBe('archived');
    expect(classifyPublicSite(404, null).kind).toBe('not-found');
    expect(classifyPublicSite(200, { status: 'PUBLISHED', slug: 'ok', content: {} }).kind).toBe(
      'ok',
    );
    expect(classifyPublicSite(200, { status: 'READ_ONLY', slug: 'ro', content: {} }).kind).toBe(
      'ok',
    );
  });

  it('caches by-host responses for 60s and returns known hosts', async () => {
    const cache = new ByHostMemoryCache();
    const fetchImpl = jasmine.createSpy('fetch').and.resolveTo(
      new Response(JSON.stringify({ status: 'PUBLISHED', slug: 'loja', content: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const first = await fetchPublicSiteByHost('loja.sejaengajado.com.br', fetchImpl, cache);
    const second = await fetchPublicSiteByHost('loja.sejaengajado.com.br', fetchImpl, cache);

    expect(first.kind).toBe('ok');
    expect(second.kind).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps archived host to gone without body parse', async () => {
    const cache = new ByHostMemoryCache();
    const fetchImpl = jasmine.createSpy('fetch').and.resolveTo(new Response(null, { status: 410 }));

    const result = await fetchPublicSiteByHost('old.sejaengajado.com.br', fetchImpl, cache);
    expect(result.kind).toBe('archived');
  });
});
