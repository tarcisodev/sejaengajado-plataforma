import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { migrationAvailable } from '../../core/admin/migration';
import type { ImpersonateResultDto, ResellerSummaryDto } from '../../core/api/admin-api.types';
import { API_PORT } from '../../core/api/api-port';
import { Reseller, ResellerPlan } from '../../core/models/domain';

@Component({
  selector: 'app-admin-resellers',
  imports: [
    BrnAlertDialogContent,
    HlmAlert,
    HlmAlertDialogImports,
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
  readonly plans = signal<ResellerPlan[]>([]);
  readonly creating = signal(false);
  readonly resellerPlanId = signal('');
  readonly graceDays = signal(30);
  readonly message = signal('');
  readonly error = signal('');
  readonly ready = signal(false);
  readonly placeholders = [1, 2, 3];
  readonly selectedId = signal<string | null>(null);
  readonly summary = signal<ResellerSummaryDto | null>(null);
  readonly impersonation = signal<ImpersonateResultDto | null>(null);
  readonly blockTargetId = signal<string | null>(null);
  readonly blockReason = signal('');

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      rows: this.api.listResellers(),
      config: this.api.getPlatformConfig(),
      plans: this.api.listResellerPlans(),
    }).subscribe(({ rows, config, plans }) => {
      this.rows.set(rows);
      this.plans.set(plans);
      this.graceDays.set(config.resellerGraceDays);
      if (!this.resellerPlanId()) {
        this.resellerPlanId.set(plans[0]?.id ?? '');
      }
      this.ready.set(true);
      const selected = this.selectedId();
      if (selected) {
        this.openDetail(selected);
      }
    });
  }

  openDetail(resellerId: string): void {
    this.selectedId.set(resellerId);
    this.api.getResellerSummary(resellerId).subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => this.summary.set(null),
    });
  }

  canMigrate(reseller: Reseller): boolean {
    return migrationAvailable(
      reseller.status,
      reseller.delinquentSince,
      this.today,
      this.graceDays(),
    );
  }

  openBlock(resellerId: string): void {
    this.blockTargetId.set(resellerId);
    this.blockReason.set('');
    this.error.set('');
  }

  confirmBlock(): void {
    const resellerId = this.blockTargetId();
    const reason = this.blockReason().trim();
    if (!resellerId) {
      return;
    }
    if (!reason) {
      this.error.set('Motivo obrigatório');
      return;
    }
    this.error.set('');
    this.api
      .blockReseller(resellerId, {
        actorId: 'admin',
        reason,
        siteIds: [],
        blockedAt: new Date().toISOString(),
      })
      .subscribe({
        next: () => {
          this.message.set('Revendedor bloqueado.');
          this.blockTargetId.set(null);
          this.reload();
        },
        error: () => toast.error('Não foi possível bloquear.'),
      });
  }

  unblock(resellerId: string): void {
    this.api.unblockReseller(resellerId, 'admin', new Date().toISOString()).subscribe(() => {
      this.message.set('Revendedor desbloqueado. Os sites suspensos continuam fora do ar.');
      this.reload();
    });
  }

  suspendSites(resellerId: string): void {
    this.api.suspendResellerSites(resellerId).subscribe({
      next: (result) => {
        this.message.set(`${result.count} site(s) suspenso(s).`);
        this.openDetail(resellerId);
      },
      error: () => toast.error('Não foi possível suspender os sites.'),
    });
  }

  offer(resellerId: string): void {
    this.api.offerMigration(resellerId, 'admin', this.today).subscribe(() => {
      this.message.set('Migração oferecida. O cliente ainda não foi transferido.');
    });
  }

  impersonate(resellerId: string): void {
    this.api.impersonateReseller(resellerId).subscribe({
      next: (result) => {
        this.impersonation.set(result);
        toast.success(`Impersonação somente leitura: ${result.name}`);
      },
      error: () => toast.error('Impersonação indisponível.'),
    });
  }

  clearImpersonation(): void {
    this.impersonation.set(null);
  }

  tone(status: string): 'destructive' | 'secondary' {
    return status === 'BLOCKED' || status === 'DELINQUENT' ? 'destructive' : 'secondary';
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
        userId: String(data.get('email') ?? ''),
        resellerPlanId: this.resellerPlanId(),
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.message.set('Revendedor criado (convite por e-mail).');
          this.reload();
        },
        error: () => toast.error('Não foi possível criar o revendedor.'),
      });
  }
}
