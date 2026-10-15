import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { migrationAvailable } from '../../core/admin/migration';
import { API_PORT } from '../../core/api/api-port';
import { Reseller, ResellerPlan, Site } from '../../core/models/domain';

const ACTOR = 'user_admin';

@Component({
  selector: 'app-admin-resellers',
  imports: [
    HlmAlert,
    HlmBadge,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmSelectImports,
    HlmSkeleton,
    HlmTableImports,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-resellers.component.html',
})
export class AdminResellersComponent {
  private readonly api = inject(API_PORT);
  today = new Date();
  readonly rows = signal<Reseller[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly plans = signal<ResellerPlan[]>([]);
  readonly creating = signal(false);
  readonly resellerPlanId = signal('');
  readonly graceDays = signal(30);
  readonly message = signal('');
  readonly error = signal('');
  readonly ready = signal(false);
  readonly placeholders = [1, 2, 3];

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      rows: this.api.listResellers(),
      sites: this.api.listSites(),
      config: this.api.getPlatformConfig(),
      plans: this.api.listResellerPlans(),
    }).subscribe(({ rows, sites, config, plans }) => {
      this.rows.set(rows);
      this.sites.set(sites);
      this.plans.set(plans);
      this.graceDays.set(config.resellerGraceDays);
      if (!this.resellerPlanId()) {
        this.resellerPlanId.set(plans[0]?.id ?? '');
      }
      this.ready.set(true);
    });
  }

  owned(resellerId: string): Site[] {
    return this.sites().filter((site) => site.resellerId === resellerId);
  }

  canMigrate(reseller: Reseller): boolean {
    return migrationAvailable(
      reseller.status,
      reseller.delinquentSince,
      this.today,
      this.graceDays(),
    );
  }

  block(resellerId: string, event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const reason = String(data.get('reason') ?? '');
    if (!reason.trim()) {
      this.error.set('Motivo obrigatório');
      return;
    }
    this.error.set('');
    this.api
      .blockReseller(resellerId, {
        actorId: ACTOR,
        reason,
        siteIds: data.getAll('siteId').map(String),
        blockedAt: new Date().toISOString(),
      })
      .subscribe(() => {
        this.message.set('Revendedor bloqueado. Os sites marcados foram suspensos.');
        this.reload();
      });
  }

  unblock(resellerId: string): void {
    this.api.unblockReseller(resellerId, ACTOR, new Date().toISOString()).subscribe(() => {
      this.message.set('Revendedor desbloqueado. Os sites suspensos continuam fora do ar.');
      this.reload();
    });
  }

  tone(status: string): 'destructive' | 'secondary' {
    return status === 'BLOCKED' || status === 'DELINQUENT' ? 'destructive' : 'secondary';
  }

  offer(resellerId: string): void {
    this.api.offerMigration(resellerId, ACTOR, this.today).subscribe(() => {
      this.message.set('Migração oferecida. O cliente ainda não foi transferido.');
    });
  }

  planLabel = (value: string | null): string => {
    return this.plans().find((plan) => plan.id === value)?.nome ?? 'Plano';
  };

  setPlan(value: string | null | undefined): void {
    this.resellerPlanId.set(value ?? '');
  }

  save(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.api
      .createReseller({
        nome: String(data.get('nome') ?? ''),
        userId: String(data.get('userId') ?? ''),
        resellerPlanId: this.resellerPlanId(),
      })
      .subscribe(() => {
        this.creating.set(false);
        this.message.set('Revendedor criado.');
        this.reload();
      });
  }
}
