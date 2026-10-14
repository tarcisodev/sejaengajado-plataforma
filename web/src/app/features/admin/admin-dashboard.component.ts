import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { toCivilDate } from '../../core/api/plaque-penalty';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly month = signal('');
  readonly revenue = signal(0);
  readonly activeSites = signal(0);
  readonly mrr = signal(0);
  readonly delinquent = signal(0);

  constructor() {
    const month = toCivilDate(new Date()).slice(0, 7);
    this.month.set(month);
    forkJoin({
      payments: this.api.listPayments(),
      sites: this.api.listSites(),
      plans: this.api.listPlans(),
      resellers: this.api.listResellers(),
    }).subscribe(({ payments, sites, plans, resellers }) => {
      const active = sites.filter(
        (site) => site.status === 'PUBLISHED' || site.status === 'READ_ONLY',
      );
      const recurring = new Set(
        plans.filter((plan) => plan.tipo === 'RECURRING').map((plan) => plan.id),
      );
      const price = new Map(plans.map((plan) => [plan.id, plan.precoCentavos]));
      this.revenue.set(
        payments
          .filter((payment) => payment.status === 'PAID' && payment.paidAt?.startsWith(month))
          .reduce((sum, payment) => sum + payment.valor, 0),
      );
      this.activeSites.set(active.length);
      this.mrr.set(
        active
          .filter((site) => recurring.has(site.planId))
          .reduce((sum, site) => sum + (price.get(site.planId) ?? 0), 0),
      );
      this.delinquent.set(resellers.filter((reseller) => reseller.status === 'DELINQUENT').length);
    });
  }
}
