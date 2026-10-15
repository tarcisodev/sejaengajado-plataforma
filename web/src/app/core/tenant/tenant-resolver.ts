import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';

import { API_PORT } from '../api/api-port';
import { HostDecision, resolveHost } from './resolve-host';
import { TenantView, viewForSite } from './tenant-view';

@Injectable()
export class TenantResolver {
  private readonly api = inject(API_PORT);

  resolve(host: string, search = ''): Observable<TenantView> {
    return this.fromDecision(resolveHost(host, search));
  }

  private fromDecision(decision: HostDecision): Observable<TenantView> {
    if (decision.kind !== 'tenant') {
      return of(decision);
    }
    return this.api
      .getSiteBySlug(decision.slug)
      .pipe(map((site) => viewForSite(site, decision.slug)));
  }
}
