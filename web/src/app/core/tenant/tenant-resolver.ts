import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';

import { API_PORT } from '../api/api-port';
import { siteFromPublicBody } from '../api/public-site.mapper';
import { SSR_PUBLIC_SITE } from '../ssr/ssr-public-site';
import { HostDecision, resolveHost } from './resolve-host';
import { TenantView, viewForSite } from './tenant-view';

@Injectable()
export class TenantResolver {
  private readonly api = inject(API_PORT);
  private readonly ssrSite = inject(SSR_PUBLIC_SITE, { optional: true });
  private readonly platformId = inject(PLATFORM_ID);

  resolve(host: string, search = ''): Observable<TenantView> {
    return this.fromDecision(resolveHost(host, search));
  }

  private fromDecision(decision: HostDecision): Observable<TenantView> {
    if (decision.kind !== 'tenant') {
      return of(decision);
    }
    // Express already fetched by-host — reuse body (avoids Nest 304 / undici cache miss).
    if (this.ssrSite) {
      return of(viewForSite(siteFromPublicBody(this.ssrSite, decision.slug), decision.slug));
    }
    // On SSR, never do a second by-host GET. Missing prefetch means Express should
    // have returned 502/404 already; treating as not-found avoids TypeError storms.
    if (isPlatformServer(this.platformId)) {
      return of({ kind: 'not-found', slug: decision.slug });
    }
    return this.api
      .getSiteBySlug(decision.slug)
      .pipe(map((site) => viewForSite(site, decision.slug)));
  }
}
