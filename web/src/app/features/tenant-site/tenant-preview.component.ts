import { Component, Input } from '@angular/core';

import { Site } from '../../core/models/domain';

@Component({
  selector: 'app-tenant-preview',
  templateUrl: './tenant-preview.component.html',
  styleUrl: './tenant-preview.component.scss',
})
export class TenantPreviewComponent {
  @Input({ required: true }) site!: Site;
}
