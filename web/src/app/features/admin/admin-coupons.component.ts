import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Coupon, Plan } from '../../core/models/domain';

@Component({
  selector: 'app-admin-coupons',
  imports: [
    BrnAlertDialogContent,
    HlmAlertDialogImports,
    HlmButton,
    HlmCardImports,
    HlmCheckbox,
    HlmInput,
    HlmSelectImports,
    HlmSkeleton,
    HlmTableImports,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-coupons.component.html',
})
export class AdminCouponsComponent {
  private readonly api = inject(API_PORT);
  readonly rows = signal<Coupon[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly planIds = signal<string[]>([]);
  readonly tipo = signal<'PCT' | 'FIXED'>('PCT');
  readonly ready = signal(false);
  readonly placeholders = [1, 2, 3];
  readonly tipoLabel = (value: string | null): string =>
    value === 'FIXED' ? 'Valor fixo' : 'Percentual';

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({ rows: this.api.listCoupons(), plans: this.api.listPlans() }).subscribe(
      ({ rows, plans }) => {
        this.rows.set(rows);
        this.plans.set(plans);
        this.ready.set(true);
      },
    );
  }

  save(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    this.api
      .saveCoupon({
        id: '',
        code: String(data.get('code') ?? '')
          .trim()
          .toUpperCase(),
        tipo: this.tipo(),
        valor: Number(data.get('valor')),
        validade: String(data.get('validade') ?? ''),
        maxUsos: Number(data.get('maxUsos')),
        usos: 0,
        planIds: this.planIds(),
      })
      .subscribe(() => {
        form.reset();
        this.planIds.set([]);
        this.tipo.set('PCT');
        toast.success('Alterações salvas.');
        this.reload();
      });
  }

  setTipo(value: string | null | undefined): void {
    this.tipo.set(value === 'FIXED' ? 'FIXED' : 'PCT');
  }

  picked(planId: string): boolean {
    return this.planIds().includes(planId);
  }

  pick(planId: string, checked: boolean): void {
    this.planIds.update((ids) => (checked ? [...ids, planId] : ids.filter((id) => id !== planId)));
  }

  remove(couponId: string): void {
    this.api.deleteCoupon(couponId).subscribe(() => this.reload());
  }
}
