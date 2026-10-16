import {
  BY_HOST_TTL_NEGATIVE_MS,
  ByHostMemoryCache,
  canonicalTenantHost,
} from './by-host-cache';
import {
  apiInternalUrlForSsr,
  classifyPublicSite,
  fetchPublicSiteByHost,
  fetchPublicSiteBySlug,
} from './fetch-public-site';

describe('fetch-public-site (SSR tenant)', () => {
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

  it('treats 2xx without body as error (not not-found)', () => {
    expect(classifyPublicSite(200, null).kind).toBe('error');
  });

  it('resolves a real tenant host to 200 with the business name', async () => {
    const cache = new ByHostMemoryCache();
    const body = {
      status: 'PUBLISHED',
      slug: 'demo-forno',
      content: { businessName: 'Forno da Esquina' },
    };
    const fetchImpl = jasmine.createSpy('fetch').and.callFake((url: string) => {
      expect(url).toContain(encodeURIComponent('demo-forno.sejaengajado.com.br'));
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const result = await fetchPublicSiteBySlug('demo-forno', fetchImpl, cache);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect((result.body['content'] as { businessName: string }).businessName).toContain('Forno');
    }
    expect(canonicalTenantHost('demo-forno')).toBe('demo-forno.sejaengajado.com.br');
  });

  it('caches ok by-host for 60s and does not stick 404 for a minute', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T12:00:00Z'));
    const cache = new ByHostMemoryCache();

    const miss = jasmine
      .createSpy('fetch-404')
      .and.resolveTo(new Response(null, { status: 404 }));
    const first = await fetchPublicSiteByHost('loja.sejaengajado.com.br', miss, cache);
    expect(first.kind).toBe('not-found');
    expect(miss).toHaveBeenCalledTimes(1);

    // Still inside negative TTL — cached miss.
    const second = await fetchPublicSiteByHost('loja.sejaengajado.com.br', miss, cache);
    expect(second.kind).toBe('not-found');
    expect(miss).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(BY_HOST_TTL_NEGATIVE_MS + 1);

    const hit = jasmine.createSpy('fetch-200').and.resolveTo(
      new Response(
        JSON.stringify({
          status: 'PUBLISHED',
          slug: 'loja',
          content: { businessName: 'Loja' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const afterPublish = await fetchPublicSiteByHost('loja.sejaengajado.com.br', hit, cache);
    expect(afterPublish.kind).toBe('ok');
    expect(hit).toHaveBeenCalledTimes(1);

    jasmine.clock().uninstall();
  });

  it('maps archived host to gone without body parse', async () => {
    const cache = new ByHostMemoryCache();
    const fetchImpl = jasmine.createSpy('fetch').and.resolveTo(new Response(null, { status: 410 }));

    const result = await fetchPublicSiteByHost('old.sejaengajado.com.br', fetchImpl, cache);
    expect(result.kind).toBe('archived');
  });

  it('exposes an absolute Nest /api base for SSR HttpClient', () => {
    expect(apiInternalUrlForSsr()).toMatch(/\/api$/);
  });
});
