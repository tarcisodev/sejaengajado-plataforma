import { Component, Input } from '@angular/core';

import { TenantView } from '../../core/tenant/tenant-view';

type NoticeView = Extract<TenantView, { kind: 'suspended' | 'archived' | 'not-found' }>;

@Component({
  selector: 'app-site-notice',
  templateUrl: './site-notice.component.html',
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
    return 'Sem dono';
  }
}
