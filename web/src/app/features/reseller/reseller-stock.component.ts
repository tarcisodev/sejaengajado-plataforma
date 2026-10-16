import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { finalize, forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import type {
  PlaqueMovementDto,
  PlaqueStockItemDto,
  ResellerSiteDto,
} from '../../core/api/reseller-api.types';
import { formatBrl } from '../landing/landing-seo';
import { brlInputToCents, centsToBrlInput } from './reseller-sales.component';

@Component({
  selector: 'app-reseller-stock',
  imports: [DatePipe, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="grid gap-4 sm:grid-cols-2" data-plaque-stock>
      @for (row of stock(); track row.plaqueType) {
        <article hlmCard class="p-4">
          <p class="text-sm text-muted-foreground">Placa {{ row.plaqueType }}</p>
          <p class="mt-1 font-display text-3xl" [attr.data-stock-qty]="row.plaqueType">
            {{ row.qty }}
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            Custo médio:
            {{ row.avgCostCents === null ? '—' : formatBrl(row.avgCostCents) }}
          </p>
        </article>
      } @empty {
        <p class="text-sm text-muted-foreground sm:col-span-2">Sem saldo de placas ainda.</p>
      }
    </section>

    <section hlmCard class="mt-6 p-4 md:p-6">
      <h2 class="font-display text-xl">Entrada de placas</h2>
      <form class="mt-4 grid gap-3 sm:grid-cols-3" data-stock-in-form (submit)="recordIn($event)">
        <label class="grid gap-1 text-sm">
          Tipo
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="plaqueType"
            required
            [disabled]="submitting()"
          >
            <option value="QR">QR</option>
            <option value="NFC">NFC</option>
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
            [disabled]="submitting()"
          />
        </label>
        <label class="grid gap-1 text-sm">
          Custo unitário (R$)
          <input
            hlmInput
            class="h-11"
            name="unitCostBrl"
            type="text"
            inputmode="decimal"
            [value]="unitCostBrl()"
            [disabled]="submitting()"
            (input)="unitCostBrl.set(inputValue($event))"
          />
        </label>
        <div class="sm:col-span-3">
          <button hlmBtn class="h-11" type="submit" data-stock-in-submit [disabled]="submitting()">
            {{ submitting() ? 'Registrando…' : 'Registrar entrada' }}
          </button>
        </div>
      </form>
    </section>

    <section hlmCard class="mt-6 p-4 md:p-6">
      <h2 class="font-display text-xl">Brinde (só Engajado Pro)</h2>
      <form
        class="mt-4 grid gap-3 sm:grid-cols-3"
        data-stock-gift-form
        (submit)="recordGift($event)"
      >
        <label class="grid gap-1 text-sm sm:col-span-2">
          Site
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="siteId"
            required
            [disabled]="submitting()"
          >
            @for (site of sites(); track site.id) {
              <option [value]="site.id">
                {{ site.slug }} · {{ site.customer?.name ?? site.customerId }}
              </option>
            }
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          Tipo
          <select
            class="h-11 rounded-lg border border-input bg-background px-3"
            name="plaqueType"
            required
            [disabled]="submitting()"
          >
            <option value="QR">QR</option>
            <option value="NFC">NFC</option>
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
            [disabled]="submitting()"
          />
        </label>
        <div class="sm:col-span-3">
          <button
            hlmBtn
            class="h-11"
            type="submit"
            data-stock-gift-submit
            [disabled]="submitting()"
          >
            Registrar brinde
          </button>
        </div>
      </form>
    </section>

    <section class="mt-6 overflow-x-auto">
      <h2 class="mb-3 font-display text-xl">Movimentos</h2>
      <table hlmTable class="w-full min-w-[36rem]" data-plaque-movements>
        <thead>
          <tr hlmTr>
            <th hlmTh>Quando</th>
            <th hlmTh>Tipo</th>
            <th hlmTh>Placa</th>
            <th hlmTh>Qtd</th>
            <th hlmTh>Custo</th>
          </tr>
        </thead>
        <tbody>
          @for (row of movements(); track row.id) {
            <tr hlmTr [attr.data-movement-id]="row.id" [attr.data-reseller-id]="row.resellerId">
              <td hlmTd>{{ row.createdAt | date: 'short' }}</td>
              <td hlmTd>{{ row.type }}</td>
              <td hlmTd>{{ row.plaqueType }}</td>
              <td hlmTd>{{ row.qty }}</td>
              <td hlmTd>
                {{ row.unitCostCents === null ? '—' : formatBrl(row.unitCostCents) }}
              </td>
            </tr>
          } @empty {
            <tr hlmTr>
              <td hlmTd colspan="5" class="text-muted-foreground">Nenhum movimento ainda.</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class ResellerStockComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly stock = signal<PlaqueStockItemDto[]>([]);
  readonly movements = signal<PlaqueMovementDto[]>([]);
  readonly sites = signal<ResellerSiteDto[]>([]);
  readonly unitCostBrl = signal(centsToBrlInput(1300));
  readonly submitting = signal(false);
  private pendingKey: string | null = null;

  constructor() {
    this.reload();
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  reload(): void {
    forkJoin({
      stock: this.api.listResellerPlaqueStock(),
      movements: this.api.listResellerPlaqueMovements(),
      sites: this.api.listResellerSites(),
    }).subscribe(({ stock, movements, sites }) => {
      this.stock.set(stock.items);
      this.movements.set(movements.items);
      this.sites.set(sites.items);
    });
  }

  recordIn(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }
    const data = new FormData(event.target as HTMLFormElement);
    const plaqueType = String(data.get('plaqueType') ?? 'QR') as 'QR' | 'NFC';
    const qty = Number(data.get('qty') ?? 1);
    const unitCostCents = brlInputToCents(String(data.get('unitCostBrl') ?? this.unitCostBrl()));
    this.runMove(
      {
        type: 'IN',
        plaqueType,
        qty,
        unitCostCents,
        reason: 'compra',
      },
      'Entrada registrada.',
    );
  }

  recordGift(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }
    const data = new FormData(event.target as HTMLFormElement);
    const siteId = String(data.get('siteId') ?? '');
    const plaqueType = String(data.get('plaqueType') ?? 'QR') as 'QR' | 'NFC';
    const qty = Number(data.get('qty') ?? 1);
    if (!siteId) {
      toast.error('Selecione um site.');
      return;
    }
    this.runMove(
      {
        type: 'OUT',
        plaqueType,
        qty,
        reason: 'GIFT',
        siteId,
      },
      'Brinde registrado.',
    );
  }

  private runMove(
    body:
      | {
          type: 'IN';
          plaqueType: 'QR' | 'NFC';
          qty: number;
          unitCostCents?: number;
          reason?: string;
        }
      | {
          type: 'OUT';
          plaqueType: 'QR' | 'NFC';
          qty: number;
          reason: 'GIFT';
          siteId: string;
        },
    okMessage: string,
  ): void {
    const key = this.pendingKey ?? crypto.randomUUID();
    this.pendingKey = key;
    this.submitting.set(true);
    this.api
      .recordResellerPlaqueMovement(body, key)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.pendingKey = null;
        }),
      )
      .subscribe({
        next: () => {
          toast.success(okMessage);
          this.reload();
        },
        error: (err: { error?: { code?: string } }) => {
          if (err?.error?.code === 'STOCK_INSUFFICIENT') {
            toast.error('Estoque insuficiente.');
            return;
          }
          if (err?.error?.code === 'GIFT_PRO_ONLY') {
            toast.error('Brinde só em site Engajado Pro.');
            return;
          }
          toast.error('Não foi possível registrar o movimento.');
        },
      });
  }
}
