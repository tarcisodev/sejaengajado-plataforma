import { Injectable, inject } from '@angular/core';
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
    return this.api
      .getSiteBySlug(decision.slug)
      .pipe(map((site) => viewForSite(site, decision.slug)));
  }
}
