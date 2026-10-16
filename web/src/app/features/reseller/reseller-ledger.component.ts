import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { API_PORT } from '../../core/api/api-port';
import type { LedgerStatementDto } from '../../core/api/reseller-api.types';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-reseller-ledger',
  imports: [DatePipe, HlmCardImports, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (statement(); as st) {
      <div class="grid gap-4 sm:grid-cols-2">
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Abertura</p>
          <p class="mt-1 font-display text-2xl" data-opening>{{ formatBrl(st.openingCents) }}</p>
        </section>
        <section hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Fechamento</p>
          <p class="mt-1 font-display text-2xl" data-closing>{{ formatBrl(st.closingCents) }}</p>
        </section>
      </div>
      <section class="mt-6 overflow-x-auto">
        <table hlmTable class="w-full min-w-[36rem]">
          <thead>
            <tr hlmTr>
              <th hlmTh>Quando</th>
              <th hlmTh>Tipo</th>
              <th hlmTh>Categoria</th>
              <th hlmTh>Valor</th>
            </tr>
          </thead>
          <tbody>
            @for (row of st.items; track row.id) {
              <tr hlmTr [attr.data-ledger-id]="row.id" [attr.data-reseller-id]="row.resellerId">
                <td hlmTd>{{ row.createdAt | date: 'short' }}</td>
                <td hlmTd>{{ row.type }}</td>
                <td hlmTd>{{ row.category }}</td>
                <td hlmTd>{{ formatBrl(row.amountCents) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    } @else {
      <p class="text-sm text-muted-foreground">Carregando extrato…</p>
    }
  `,
})
export class ResellerLedgerComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly statement = signal<LedgerStatementDto | null>(null);

  constructor() {
    this.api.getResellerLedger().subscribe((statement) => this.statement.set(statement));
  }
}
