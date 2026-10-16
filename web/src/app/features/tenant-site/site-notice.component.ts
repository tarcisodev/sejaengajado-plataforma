import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import { TenantView } from '../../core/tenant/tenant-view';

type NoticeView = Extract<
  TenantView,
  { kind: 'suspended' | 'archived' | 'not-found' | 'ssr-unavailable' }
>;

@Component({
  selector: 'app-site-notice',
  templateUrl: './site-notice.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './site-notice.component.scss',
})
export class SiteNoticeComponent {
  @Input({ required: true }) view!: NoticeView;

  stamp(): string {
    if (this.view.kind === 'suspended') {
      return 'Fechado';
    }
    if (this.view.kind === 'archived') {
      return 'Encerrado';
    }
    if (this.view.kind === 'ssr-unavailable') {
      return 'Indisponível';
    }
    return 'Sem dono';
  }
}
