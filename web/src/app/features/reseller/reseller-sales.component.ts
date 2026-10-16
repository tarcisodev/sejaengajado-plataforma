import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import type { ResellerSaleDto, WholesaleItemDto } from '../../core/api/reseller-api.types';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-reseller-sales',
  imports: [DatePipe, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section hlmCard class="p-4 md:p-6">
      <h2 class="font-display text-xl">Registrar venda</h2>
      <form class="mt-4 grid gap-3 sm:grid-cols-3" (submit)="record($event)">
        <label class="grid gap-1 text-sm sm:col-span-2">
          Produto
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="productId"
            required
            (change)="onProduct($event)"
          >
            @for (item of wholesale(); track item.productId) {
              <option [value]="item.productId">
                {{ item.name }} · custo {{ formatBrl(item.baseWholesaleCents) }}
              </option>
            }
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          Qtd
          <input
            hlmInput
            class="h-11"
            name="qty"
            type="number"
            min="1"
            value="1"
            required
            (input)="qty.set(+inputValue($event) || 1)"
          />
        </label>
        <label class="grid gap-1 text-sm">
          Preço unitário (centavos da API)
          <input
            hlmInput
            class="h-11"
            name="unitPriceCents"
            type="number"
            min="0"
            [value]="unitPriceCents()"
            required
            (input)="unitPriceCents.set(+inputValue($event) || 0)"
          />
        </label>
        <p class="text-sm sm:col-span-2" data-margin>
          Margem prevista:
          <span [class.text-destructive]="margin() < 0">{{ formatBrl(margin()) }}</span>
        </p>
        <div>
          <button hlmBtn class="h-11" type="submit">Registrar</button>
        </div>
      </form>
    </section>

    <section class="mt-6 overflow-x-auto">
      <table hlmTable class="w-full min-w-[32rem]">
        <thead>
          <tr hlmTr>
            <th hlmTh>Quando</th>
            <th hlmTh>Margem prevista</th>
            <th hlmTh>Itens</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr hlmTr [attr.data-sale-id]="row.id" [attr.data-reseller-id]="row.resellerId">
              <td hlmTd>{{ row.createdAt | date: 'short' }}</td>
              <td hlmTd>{{ formatBrl(row.predictedMarginCents ?? 0) }}</td>
              <td hlmTd>{{ row.items?.length ?? 0 }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class ResellerSalesComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly rows = signal<ResellerSaleDto[]>([]);
  readonly wholesale = signal<WholesaleItemDto[]>([]);
  readonly qty = signal(1);
  readonly unitPriceCents = signal(0);
  readonly unitCostCents = signal(0);
  readonly margin = computed(
    () => this.qty() * (this.unitPriceCents() - this.unitCostCents()),
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      sales: this.api.listResellerSales(),
      wholesale: this.api.listResellerWholesale(),
    }).subscribe(({ sales, wholesale }) => {
      this.rows.set(sales.items);
      this.wholesale.set(wholesale.items);
      const first = wholesale.items[0];
      if (first) {
        this.unitPriceCents.set(first.priceCents);
        this.unitCostCents.set(first.baseWholesaleCents);
      }
    });
  }

  onProduct(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const item = this.wholesale().find((row) => row.productId === id);
    if (!item) {
      return;
    }
    this.unitPriceCents.set(item.priceCents);
    this.unitCostCents.set(item.baseWholesaleCents);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  record(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const productId = String(data.get('productId') ?? '');
    const qty = Number(data.get('qty') ?? 1);
    const unitPriceCents = Number(data.get('unitPriceCents') ?? 0);
    const key = crypto.randomUUID();
    this.api.recordResellerSale([{ productId, qty, unitPriceCents }], key).subscribe({
      next: () => {
        toast.success('Venda registrada.');
        this.reload();
      },
      error: () => toast.error('Não foi possível registrar a venda.'),
    });
  }
}
