import { ByHostMemoryCache } from './by-host-cache';

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

  it('expires after TTL', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-16T12:00:00Z'));
    const cache = new ByHostMemoryCache();
    cache.set('demo-forno.sejaengajado.com.br', 200, { slug: 'demo-forno' });
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeTruthy();
    jasmine.clock().tick(61_000);
    expect(cache.get('demo-forno.sejaengajado.com.br')).toBeNull();
    jasmine.clock().uninstall();
  });
});
