import { Component, inject, signal } from '@angular/core';

import { API_PORT } from '../../core/api/api-port';
import { PlatformConfig } from '../../core/models/domain';

@Component({
  selector: 'app-admin-config',
  templateUrl: './admin-config.component.html',
})
export class AdminConfigComponent {
  private readonly api = inject(API_PORT);
  readonly saved = signal(false);
  readonly config = signal<PlatformConfig | null>(null);

  constructor() {
    this.api.getPlatformConfig().subscribe((config) => this.config.set(config));
  }

  save(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const number = (name: string) => Number(data.get(name));
    this.api
      .updatePlatformConfig({
        notifyFromDias: number('notifyFromDias'),
        readOnlyDias: number('readOnlyDias'),
        suspendDias: number('suspendDias'),
        archiveDias: number('archiveDias'),
        prontoRenewalCentavos: number('prontoRenewalCentavos'),
        plaqueValueCentavos: number('plaqueValueCentavos'),
        plaquePenaltyPct: number('plaquePenaltyPct'),
        resellerGraceDays: number('resellerGraceDays'),
      })
      .subscribe((config) => {
        this.config.set(config);
        this.saved.set(true);
      });
  }
}
