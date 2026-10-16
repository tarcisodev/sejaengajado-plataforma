import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { finalize, forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import type {
  ResellerPriceItemDto,
  ResellerSaleDto,
  WholesaleItemDto,
} from '../../core/api/reseller-api.types';
import { formatBrl } from '../landing/landing-seo';

/** Converte digitação pt-BR (1.234,56 ou 12,5) em centavos. */
export function brlInputToCents(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value * 100);
}

export function centsToBrlInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function plaqueLabel(code: string): string | null {
  if (code === 'PLAQUE_QR' || code === 'PLACA_QR') {
    return 'QR';
  }
  if (code === 'PLAQUE_NFC' || code === 'PLACA_NFC') {
    return 'NFC';
  }
  return null;
}

@Component({
  selector: 'app-reseller-sales',
  imports: [DatePipe, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section hlmCard class="p-4 md:p-6">
      <h2 class="font-display text-xl">Registrar venda</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Custo e preço ficam congelados na venda (centavos na API; reais na tela).
      </p>
      <form class="mt-4 grid gap-3 sm:grid-cols-3" data-sale-form (submit)="record($event)">
        <label class="grid gap-1 text-sm sm:col-span-2">
          Produto
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="productId"
            required
            data-sale-product
            [disabled]="submitting()"
            (change)="onProduct($event)"
          >
            @for (item of wholesale(); track item.productId) {
              <option [value]="item.productId">
                {{ item.name }}
                @if (plaqueOf(item.code); as plaque) {
                  · placa {{ plaque }}
                }
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
            step="1"
            [value]="qty()"
            required
            data-sale-qty
            [disabled]="submitting()"
            (input)="qty.set(+inputValue($event) || 1)"
          />
        </label>
        <label class="grid gap-1 text-sm">
          Preço unitário (R$)
          <input
            hlmInput
            class="h-11"
            name="unitPriceBrl"
            type="text"
            inputmode="decimal"
            required
            data-sale-price
            [value]="unitPriceBrl()"
            [disabled]="submitting()"
            (input)="onPriceInput($event)"
          />
        </label>
        <p class="text-sm sm:col-span-2" data-sale-frozen>
          Custo congelado: {{ formatBrl(unitCostCents()) }} · Preço congelado:
          {{ formatBrl(unitPriceCents()) }}
          @if (selectedPlaque(); as plaque) {
            · Placa {{ plaque }}
          }
        </p>
        <p class="text-sm sm:col-span-2" data-margin>
          Margem prevista:
          <span [class.text-destructive]="margin() < 0">{{ formatBrl(margin()) }}</span>
        </p>
        <div>
          <button
            hlmBtn
            class="h-11"
            type="submit"
            data-sale-submit
            [disabled]="submitting() || !canSubmit()"
          >
            {{ submitting() ? 'Registrando…' : 'Registrar' }}
          </button>
        </div>
      </form>
    </section>

    <section class="mt-6 overflow-x-auto">
      <table hlmTable class="w-full min-w-[36rem]">
        <thead>
          <tr hlmTr>
            <th hlmTh>Quando</th>
            <th hlmTh>Margem</th>
            <th hlmTh>Itens (custo × preço)</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr hlmTr [attr.data-sale-id]="row.id" [attr.data-reseller-id]="row.resellerId">
              <td hlmTd>{{ row.createdAt | date: 'short' }}</td>
              <td hlmTd>{{ formatBrl(row.predictedMarginCents ?? 0) }}</td>
              <td hlmTd>
                @for (item of row.items ?? []; track $index) {
                  <span class="me-2 inline-block">
                    {{ item.qty }}× {{ formatBrl(item.unitCostCents) }} →
                    {{ formatBrl(item.unitPriceCents) }}
                  </span>
                } @empty {
                  —
                }
              </td>
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
  readonly prices = signal<ResellerPriceItemDto[]>([]);
  readonly productId = signal('');
  readonly qty = signal(1);
  readonly unitPriceCents = signal(0);
  readonly unitCostCents = signal(0);
  readonly unitPriceBrl = signal('0,00');
  readonly submitting = signal(false);
  /** Reutilizado enquanto a requisição está em voo (duplo clique). */
  private pendingIdempotencyKey: string | null = null;

  readonly margin = computed(() => this.qty() * (this.unitPriceCents() - this.unitCostCents()));
  readonly selectedPlaque = computed(() => {
    const item = this.wholesale().find((row) => row.productId === this.productId());
    return item ? plaqueLabel(item.code) : null;
  });
  readonly canSubmit = computed(
    () => !!this.productId() && this.qty() >= 1 && this.unitPriceCents() >= 0,
  );

  constructor() {
    this.reload();
  }

  plaqueOf(code: string): string | null {
    return plaqueLabel(code);
  }

  reload(): void {
    forkJoin({
      sales: this.api.listResellerSales(),
      wholesale: this.api.listResellerWholesale(),
      prices: this.api.listResellerPrices(),
    }).subscribe(({ sales, wholesale, prices }) => {
      this.rows.set(sales.items);
      this.wholesale.set(wholesale.items);
      this.prices.set(prices.items);
      const first = wholesale.items[0];
      if (first && !this.productId()) {
        this.applyProduct(first);
      }
    });
  }

  onProduct(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const item = this.wholesale().find((row) => row.productId === id);
    if (item) {
      this.applyProduct(item);
    }
  }

  onPriceInput(event: Event): void {
    const raw = this.inputValue(event);
    this.unitPriceBrl.set(raw);
    this.unitPriceCents.set(brlInputToCents(raw));
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  record(event: Event): void {
    event.preventDefault();
    if (this.submitting() || !this.canSubmit()) {
      return;
    }
    const productId = this.productId();
    const qty = this.qty();
    const unitPriceCents = this.unitPriceCents();
    const key = this.pendingIdempotencyKey ?? crypto.randomUUID();
    this.pendingIdempotencyKey = key;
    this.submitting.set(true);
    this.api
      .recordResellerSale([{ productId, qty, unitPriceCents }], key)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.pendingIdempotencyKey = null;
        }),
      )
      .subscribe({
        next: () => {
          toast.success('Venda registrada.');
          this.reload();
        },
        error: () => toast.error('Não foi possível registrar a venda.'),
      });
  }

  private applyProduct(item: WholesaleItemDto): void {
    this.productId.set(item.productId);
    this.unitCostCents.set(item.priceCents > 0 ? item.priceCents : item.baseWholesaleCents);
    const suggested =
      this.prices().find((row) => row.productId === item.productId)?.priceCents ?? item.priceCents;
    this.unitPriceCents.set(suggested);
    this.unitPriceBrl.set(centsToBrlInput(suggested));
  }
}
