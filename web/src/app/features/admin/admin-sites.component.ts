import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Site, SiteStatus } from '../../core/models/domain';

@Component({
  selector: 'app-admin-sites',
  imports: [
    NgIcon,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmSelectImports,
    HlmSkeleton,
    HlmTableImports,
  ],
  providers: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-sites.component.html',
})
export class AdminSitesComponent {
  private readonly api = inject(API_PORT);
  readonly query = signal('');
  readonly status = signal<SiteStatus | ''>('');
  readonly ready = signal(false);
  readonly rows = signal<Site[]>([]);
  readonly placeholders = [1, 2, 3];
  private plans = new Map<string, string>();

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({ sites: this.api.listSites(), plans: this.api.listPlans() }).subscribe(
      ({ sites, plans }) => {
        this.rows.set(sites);
        this.plans = new Map(plans.map((plan) => [plan.id, plan.nome]));
        this.ready.set(true);
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

  statusLabel = (value: string | null): string => {
    switch (value) {
      case 'PUBLISHED':
        return 'Publicado';
      case 'READ_ONLY':
        return 'Só leitura';
      case 'SUSPENDED':
        return 'Suspenso';
      case 'DRAFT':
        return 'Rascunho';
      case 'ARCHIVED':
        return 'Arquivado';
      default:
        return 'Todos';
    }
  };

  setStatus(value: string | null | undefined): void {
    this.status.set((value ?? '') as SiteStatus | '');
  }

  tone(status: string): 'destructive' | 'secondary' {
    return status === 'SUSPENDED' || status === 'READ_ONLY' ? 'destructive' : 'secondary';
  }

  suspend(site: Site): void {
    this.api.setSiteStatus(site.id, 'SUSPENDED').subscribe(() => this.reload());
  }

  reactivate(site: Site): void {
    this.api.setSiteStatus(site.id, 'PUBLISHED').subscribe(() => this.reload());
  }
}
