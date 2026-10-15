import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { API_PORT } from '../../core/api/api-port';
import { Plan, PlanType } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-admin-plans',
  imports: [HlmButton, HlmCardImports, HlmInput, HlmSelectImports, HlmSkeleton, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-plans.component.html',
})
export class AdminPlansComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly rows = signal<Plan[]>([]);
  readonly draft = signal<Plan>(emptyPlan());
  readonly tipo = signal<PlanType>('ONE_TIME');
  readonly ready = signal(false);
  readonly placeholders = [1, 2, 3];
  readonly tipoLabel = (value: string | null): string => {
    switch (value) {
      case 'RECURRING':
        return 'Mensal';
      case 'ANNUAL_HOSTING':
        return 'Renovação anual';
      default:
        return 'Pagamento único';
    }
  };

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.listPlans().subscribe((rows) => {
      this.rows.set(rows);
      this.ready.set(true);
    });
  }

  setTipo(value: string | null | undefined): void {
    if (value === 'ONE_TIME' || value === 'RECURRING' || value === 'ANNUAL_HOSTING') {
      this.tipo.set(value);
    }
  }

  edit(plan: Plan): void {
    this.draft.set({ ...plan, features: { ...plan.features } });
    this.tipo.set(plan.tipo);
  }

  save(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const current = this.draft();
    this.api
      .savePlan({
        ...current,
        code: String(data.get('code') ?? '').trim(),
        nome: String(data.get('nome') ?? '').trim(),
        tipo: this.tipo(),
        precoCentavos: Number(data.get('precoCentavos')),
        intervalo: String(data.get('intervalo') ?? '') || null,
      })
      .subscribe(() => {
        this.draft.set(emptyPlan());
        this.tipo.set('ONE_TIME');
        toast.success('Alterações salvas.');
        this.reload();
      });
  }
}

function emptyPlan(): Plan {
  return {
    id: '',
    code: '',
    nome: '',
    tipo: 'ONE_TIME',
    precoCentavos: 0,
    intervalo: null,
    features: {},
  };
}
