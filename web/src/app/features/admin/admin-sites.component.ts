import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Site, SiteStatus } from '../../core/models/domain';

@Component({
  selector: 'app-admin-sites',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-sites.component.html',
})
export class AdminSitesComponent {
  private readonly api = inject(API_PORT);
  readonly query = signal('');
  readonly status = signal<SiteStatus | ''>('');
  readonly rows = signal<Site[]>([]);
  private plans = new Map<string, string>();

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({ sites: this.api.listSites(), plans: this.api.listPlans() }).subscribe(
      ({ sites, plans }) => {
        this.rows.set(sites);
        this.plans = new Map(plans.map((plan) => [plan.id, plan.nome]));
      },
    );
  }

  visible(): Site[] {
    const query = this.query().trim().toLowerCase();
    const status = this.status();
    return this.rows().filter((row) => {
      const name = row.content.businessName.toLowerCase();
      return (
        (!query || name.includes(query) || row.slug.includes(query)) &&
        (!status || row.status === status)
      );
    });
  }

  planName(planId: string): string {
    return this.plans.get(planId) ?? planId;
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  statusValue(event: Event): SiteStatus | '' {
    return (event.target as HTMLSelectElement).value as SiteStatus | '';
  }

  suspend(site: Site): void {
    this.api.setSiteStatus(site.id, 'SUSPENDED').subscribe(() => this.reload());
  }

  reactivate(site: Site): void {
    this.api.setSiteStatus(site.id, 'PUBLISHED').subscribe(() => this.reload());
  }
}
