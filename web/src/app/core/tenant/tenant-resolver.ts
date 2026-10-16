import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, REQUEST_CONTEXT, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';

import { API_PORT } from '../api/api-port';
import { siteFromPublicBody } from '../api/public-site.mapper';
import { SSR_PUBLIC_SITE } from '../ssr/ssr-public-site';
import type { SsrRequestContext } from '../ssr/ssr-request-context';
import { HostDecision, resolveHost } from './resolve-host';
import { TenantView, viewForSite } from './tenant-view';

@Injectable()
export class TenantResolver {
  private readonly api = inject(API_PORT);
  private readonly ssrSite = inject(SSR_PUBLIC_SITE, { optional: true });
  private readonly requestContext = inject(REQUEST_CONTEXT, {
    optional: true,
  }) as SsrRequestContext | null;
  private readonly platformId = inject(PLATFORM_ID);

  resolve(host: string, search = ''): Observable<TenantView> {
    return this.fromDecision(resolveHost(host, search));
  }

  private fromDecision(decision: HostDecision): Observable<TenantView> {
    if (decision.kind !== 'tenant') {
      return of(decision);
    }
    // Prefer REQUEST_CONTEXT (fresh every request) over a sticky useValue token.
    const prefetched = this.requestContext?.publicSite ?? this.ssrSite ?? null;
    if (prefetched) {
      return of(viewForSite(siteFromPublicBody(prefetched, decision.slug), decision.slug));
    }
    // On SSR, never invent not-found — Express must have returned 404/502 already
    // when by-host failed. Missing context means DI lost the prefetch → 502.
    if (isPlatformServer(this.platformId)) {
      console.error(
        '[ssr] SSR_PUBLIC_SITE / REQUEST_CONTEXT.publicSite missing for tenant',
        decision.slug,
      );
      return of({ kind: 'ssr-unavailable', slug: decision.slug });
    }
    return this.api
      .getSiteBySlug(decision.slug)
      .pipe(map((site) => viewForSite(site, decision.slug)));
  }
}
