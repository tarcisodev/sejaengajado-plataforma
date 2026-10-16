import { AsyncPipe, PlatformLocation } from '@angular/common';
import { Component, RESPONSE_INIT, inject, ChangeDetectionStrategy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Observable, tap } from 'rxjs';

import { hostFromLocation } from '../../core/tenant/resolve-host';
import { TenantResolver } from '../../core/tenant/tenant-resolver';
import { applyHttpStatus, TenantView, titleFor } from '../../core/tenant/tenant-view';
import { LandingPageComponent } from '../landing/landing-page.component';
import { SiteNoticeComponent } from './site-notice.component';
import { SitePageComponent } from './site-page.component';

/** Só apex + `<slug>.` — painéis autenticados ficam nas rotas do host `app.`. */
@Component({
  selector: 'app-tenant-gate',
  imports: [AsyncPipe, LandingPageComponent, SitePageComponent, SiteNoticeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './tenant-gate.component.html',
})
export class TenantGateComponent {
  private readonly resolver = inject(TenantResolver);
  private readonly location = inject(PlatformLocation);
  private readonly title = inject(Title);
  private readonly response = inject(RESPONSE_INIT, { optional: true });

  readonly view$: Observable<TenantView> = this.resolver
    .resolve(hostFromLocation(this.location), this.location.search)
    .pipe(
      tap((view) => {
        applyHttpStatus(this.response, view);
        this.title.setTitle(titleFor(view));
      }),
    );
}
