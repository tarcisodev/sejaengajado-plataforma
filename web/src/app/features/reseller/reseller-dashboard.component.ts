import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';

import { API_PORT } from '../../core/api/api-port';
import type { ResellerDashboardDto } from '../../core/api/reseller-api.types';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-reseller-dashboard',
  imports: [RouterLink, HlmButton, HlmCardImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (data(); as dash) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Sites ativos</p>
          <p class="mt-1 font-display text-3xl" data-active-sites>{{ dash.activeSites }}</p>
        </section>
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Vendas do mês</p>
          <p class="mt-1 font-display text-3xl" data-month-sales>
            {{ formatBrl(dash.monthSalesCents) }}
          </p>
        </section>
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Margem prevista</p>
          <p class="mt-1 font-display text-3xl">{{ formatBrl(dash.predictedMarginCents) }}</p>
        </section>
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Margem realizada</p>
          <p class="mt-1 font-display text-3xl">{{ formatBrl(dash.realizedMarginCents) }}</p>
        </section>
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Saldo</p>
          <p class="mt-1 font-display text-3xl" data-balance>
            {{ formatBrl(dash.balanceCents) }}
          </p>
        </section>
        @if (dash.openInvoice; as inv) {
          <section hlmCard class="p-4">
            <p class="text-sm text-muted-foreground">Fatura aberta</p>
            <p class="mt-1 font-display text-2xl">{{ formatBrl(inv.totalCents) }}</p>
            <p class="mt-1 text-sm text-muted-foreground">{{ inv.period }} · {{ inv.status }}</p>
            <a hlmBtn class="mt-3 h-11" routerLink="/revenda/faturas">Ver faturas</a>
          </section>
        }
      </div>
      @if (dash.stock.length) {
        <section class="mt-6">
          <h2 class="font-display text-xl">Estoque de placas</h2>
          <ul class="mt-2 space-y-1 text-sm">
            @for (row of dash.stock; track row.plaqueType) {
              <li>{{ row.plaqueType }}: {{ row.qty }}</li>
            }
          </ul>
        </section>
      }
    } @else {
      <p class="text-sm text-muted-foreground">Carregando painel…</p>
    }
  `,
})
export class ResellerDashboardComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly data = signal<ResellerDashboardDto | null>(null);

  constructor() {
    this.api.getResellerDashboard().subscribe((dash) => this.data.set(dash));
  }
}
