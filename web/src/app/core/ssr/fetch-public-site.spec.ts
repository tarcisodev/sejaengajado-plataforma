import { BY_HOST_TTL_NEGATIVE_MS, ByHostMemoryCache, canonicalTenantHost } from './by-host-cache';
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

  it('does not cache 404 so publish after miss is visible on the next request', async () => {
    const cache = new ByHostMemoryCache();

    const miss = jasmine.createSpy('fetch-404').and.resolveTo(new Response(null, { status: 404 }));
    const first = await fetchPublicSiteByHost('loja.sejaengajado.com.br', miss, cache);
    expect(first.kind).toBe('not-found');
    expect(miss).toHaveBeenCalledTimes(1);

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
    expect(BY_HOST_TTL_NEGATIVE_MS).toBeLessThan(10_000);
  });

  it('treats Nest 304 as transport error (not not-found)', async () => {
    const cache = new ByHostMemoryCache();
    const fetchImpl = jasmine
      .createSpy('fetch-304')
      .and.resolveTo(new Response(null, { status: 304 }));
    const result = await fetchPublicSiteByHost('loja.sejaengajado.com.br', fetchImpl, cache);
    expect(result.kind).toBe('error');
    // Retries 304 / empty transport blips.
    expect(fetchImpl.calls.count()).toBeGreaterThanOrEqual(2);
  });

  it('retries network failure then succeeds', async () => {
    const cache = new ByHostMemoryCache();
    let n = 0;
    const fetchImpl = jasmine.createSpy('fetch-retry').and.callFake(() => {
      n += 1;
      if (n < 2) {
        return Promise.reject(new Error('ECONNRESET'));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'PUBLISHED',
            slug: 'demo-forno',
            content: { businessName: 'Forno da Praça' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    const result = await fetchPublicSiteByHost('demo-forno.sejaengajado.com.br', fetchImpl, cache);
    expect(result.kind).toBe('ok');
    expect(n).toBe(2);
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
