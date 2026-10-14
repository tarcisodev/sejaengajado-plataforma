import { Component, inject, signal } from '@angular/core';

import { API_PORT } from '../../core/api/api-port';
import { Plan, PlanType } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-admin-plans',
  templateUrl: './admin-plans.component.html',
})
export class AdminPlansComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly rows = signal<Plan[]>([]);
  readonly draft = signal<Plan>(emptyPlan());

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.listPlans().subscribe((rows) => this.rows.set(rows));
  }

  edit(plan: Plan): void {
    this.draft.set({ ...plan, features: { ...plan.features } });
  }

  save(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const current = this.draft();
    const tipo = String(data.get('tipo')) as PlanType;
    this.api
      .savePlan({
        ...current,
        code: String(data.get('code') ?? '').trim(),
        nome: String(data.get('nome') ?? '').trim(),
        tipo,
        precoCentavos: Number(data.get('precoCentavos')),
        intervalo: String(data.get('intervalo') ?? '') || null,
      })
      .subscribe(() => {
        this.draft.set(emptyPlan());
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
