import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideRepeat, lucideTriangleAlert, lucideWallet } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { toCivilDate } from '../../core/api/plaque-penalty';
import { Payment, Reseller } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';
import { DashboardPreset, periodEnding, rankResellers } from './dashboard-period';

@Component({
  selector: 'app-admin-dashboard',
  imports: [NgIcon, HlmButton, HlmCardImports, HlmInput],
  providers: [provideIcons({ lucideGlobe, lucideRepeat, lucideTriangleAlert, lucideWallet })],
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
  readonly preset = signal<DashboardPreset>('30');
  readonly from = signal('');
  readonly to = signal('');
  private readonly payments = signal<Payment[]>([]);
  private readonly resellers = signal<Reseller[]>([]);
  readonly ranking = computed(() =>
    rankResellers(this.payments(), this.resellers(), this.from(), this.to()),
  );

  constructor() {
    const today = toCivilDate(new Date());
    const range = periodEnding(today, 30);
    this.from.set(range.from);
    this.to.set(range.to);
    const month = today.slice(0, 7);
    this.month.set(month);
    forkJoin({
      payments: this.api.listPayments(),
      sites: this.api.listSites(),
      plans: this.api.listPlans(),
      resellers: this.api.listResellers(),
    }).subscribe(({ payments, sites, plans, resellers }) => {
      this.payments.set(payments);
      this.resellers.set(resellers);
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

  setPreset(preset: DashboardPreset): void {
    this.preset.set(preset);
    if (preset === 'custom') {
      return;
    }
    const range = periodEnding(toCivilDate(new Date()), preset === '7' ? 7 : 30);
    this.from.set(range.from);
    this.to.set(range.to);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  barWidth(valor: number): number {
    const top = this.ranking().rows[0]?.valor ?? 0;
    if (top <= 0) {
      return 0;
    }
    return Math.round((valor / top) * 100);
  }
}
