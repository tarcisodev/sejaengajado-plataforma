import {
  BY_HOST_TTL_NEGATIVE_MS,
  BY_HOST_TTL_OK_MS,
  ByHostMemoryCache,
  canonicalTenantHost,
  normalizeHost,
} from './by-host-cache';

describe('ByHostMemoryCache', () => {
  it('caps entries so SSR memory stays bounded', () => {
    const cache = new ByHostMemoryCache();
    for (let i = 0; i < 520; i++) {
      cache.set(`tenant-${i}.sejaengajado.com.br`, 200, { slug: `t${i}` });
    }
    expect(cache.size).toBeLessThanOrEqual(500);
    expect(cache.get('tenant-519.sejaengajado.com.br')).toBeTruthy();
    expect(cache.get('tenant-0.sejaengajado.com.br')).toBeNull();
  });

  it('keeps successful by-host payloads for ~60s', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T12:00:00Z'));
    const cache = new ByHostMemoryCache();
    cache.set('demo-forno.sejaengajado.com.br', 200, { slug: 'demo-forno' });
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeTruthy();
    jasmine.clock().tick(BY_HOST_TTL_OK_MS - 1_000);
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeTruthy();
    jasmine.clock().tick(2_000);
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeNull();
    jasmine.clock().uninstall();
  });

  it('does not store 404/304 so a miss cannot poison later publishes', () => {
    const cache = new ByHostMemoryCache();
    cache.set('demo-forno.sejaengajado.com.br', 404, null);
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeNull();
    cache.set('demo-forno.sejaengajado.com.br', 304, null);
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeNull();
    expect(BY_HOST_TTL_NEGATIVE_MS).toBeLessThan(10_000);
  });

  it('builds the canonical tenant host from a slug', () => {
    expect(canonicalTenantHost('Demo-Forno')).toBe('demo-forno.sejaengajado.com.br');
    expect(normalizeHost('Demo-Forno.sejaengajado.com.br.')).toBe(
      'demo-forno.sejaengajado.com.br',
    );
  });
});
