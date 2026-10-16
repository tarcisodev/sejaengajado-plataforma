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
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';

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
    ConfirmActionComponent,
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
  readonly inviteActionLink = signal<string | null>(null);
  readonly error = signal('');
  readonly ready = signal(false);
  readonly placeholders = [1, 2, 3];
  readonly selectedId = signal<string | null>(null);
  readonly summary = signal<ResellerSummaryDto | null>(null);
  readonly detail = signal<Reseller | null>(null);
  readonly editName = signal('');
  readonly editDocument = signal('');
  readonly editPhone = signal('');
  readonly editAddressLine = signal('');
  readonly editAddressCity = signal('');
  readonly editAddressUf = signal('');
  readonly editAddressCep = signal('');
  readonly editNotes = signal('');
  readonly editPlanId = signal('');
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
        const fundadorId = '00000000-0000-4000-8000-000000000002';
        const preferred =
          plans.find((plan) => plan.id === fundadorId) ??
          plans.find((plan) => /fundador/i.test(plan.nome)) ??
          plans[0];
        this.resellerPlanId.set(preferred?.id ?? '');
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
    this.api.getReseller(resellerId).subscribe({
      next: (row) => {
        this.detail.set(row);
        this.editName.set(row.nome);
        this.editDocument.set(row.document ?? '');
        this.editPhone.set(row.phone ?? '');
        this.editAddressLine.set(row.addressLine ?? '');
        this.editAddressCity.set(row.addressCity ?? '');
        this.editAddressUf.set(row.addressUf ?? '');
        this.editAddressCep.set(row.addressCep ?? '');
        this.editNotes.set(row.notes ?? '');
        this.editPlanId.set(row.resellerPlanId);
      },
      error: () => this.detail.set(null),
    });
  }

  saveDetail(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.api
      .patchReseller(id, {
        name: this.editName().trim() || undefined,
        resellerPlanId: this.editPlanId() || undefined,
        document: this.editDocument().trim(),
        phone: this.editPhone().trim(),
        addressLine: this.editAddressLine().trim(),
        addressCity: this.editAddressCity().trim(),
        addressUf: this.editAddressUf().trim().toUpperCase().slice(0, 2),
        addressCep: this.editAddressCep().trim(),
        notes: this.editNotes().trim(),
      })
      .subscribe({
        next: (row) => {
          this.detail.set(row);
          this.message.set('Perfil do vendedor atualizado.');
          this.reload();
        },
        error: () => toast.error('Não foi possível salvar o perfil.'),
      });
  }

  resetPassword(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.api.sendResellerPasswordReset(id).subscribe({
      next: (result) => {
        this.inviteActionLink.set(result.inviteActionLink);
        this.message.set(
          result.inviteActionLink
            ? 'Link de redefinição gerado (copie abaixo). O vendedor define a senha nesse link.'
            : 'Pedido de redefinição enviado (e-mail).',
        );
      },
      error: () => toast.error('Não foi possível gerar o reset de senha.'),
    });
  }

  resetMfa(): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    this.api.resetResellerMfa(id).subscribe({
      next: (result) => {
        this.message.set(
          `MFA resetado (${result.removed} fator(es) removido(s)). No próximo login o vendedor configura de novo.`,
        );
      },
      error: () => toast.error('Não foi possível resetar o MFA.'),
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
        next: (created) => {
          this.creating.set(false);
          this.inviteActionLink.set(created.inviteActionLink ?? null);
          this.message.set(
            created.inviteActionLink
              ? 'Revendedor criado. Use o link abaixo para definir a senha (primeiro acesso). Depois entre com e-mail + senha + MFA.'
              : 'Revendedor criado (convite por e-mail para definir senha).',
          );
          this.reload();
        },
        error: () => toast.error('Não foi possível criar o revendedor.'),
      });
  }

  async copyInviteLink(): Promise<void> {
    const link = this.inviteActionLink();
    if (!link || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(link);
    toast.success('Link de convite copiado.');
  }
}
