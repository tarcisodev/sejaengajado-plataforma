import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import type { AdminProductDto, ResellerWholesaleAdminDto } from '../../core/api/admin-api.types';
import { API_PORT } from '../../core/api/api-port';
import { Reseller } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-admin-wholesale',
  imports: [DatePipe, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-wholesale.component.html',
})
export class AdminWholesaleComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly resellers = signal<Reseller[]>([]);
  readonly products = signal<AdminProductDto[]>([]);
  readonly resellerId = signal('');
  readonly data = signal<ResellerWholesaleAdminDto | null>(null);
  readonly error = signal('');

  constructor() {
    forkJoin({
      resellers: this.api.listResellers(),
      products: this.api.listAdminProducts(),
    }).subscribe(({ resellers, products }) => {
      this.resellers.set(resellers);
      this.products.set(products);
      if (resellers[0]) {
        this.resellerId.set(resellers[0].id);
        this.reload();
      }
    });
  }

  onReseller(event: Event): void {
    this.resellerId.set((event.target as HTMLSelectElement).value);
    this.reload();
  }

  reload(): void {
    const id = this.resellerId();
    if (!id) {
      return;
    }
    this.api.listResellerWholesaleAdmin(id).subscribe({
      next: (data) => this.data.set(data),
      error: () => toast.error('Não foi possível carregar o atacado.'),
    });
  }

  save(event: Event): void {
    event.preventDefault();
    this.error.set('');
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const productId = String(data.get('productId') ?? '');
    const priceCents = Number(data.get('priceCents') ?? 0);
    const validFromRaw = String(data.get('validFrom') ?? '');
    const validToRaw = String(data.get('validTo') ?? '').trim();
    if (!productId || !Number.isFinite(priceCents) || priceCents <= 0 || !validFromRaw) {
      this.error.set('Produto, preço em centavos e início da vigência são obrigatórios.');
      return;
    }
    const validFrom = new Date(validFromRaw).toISOString();
    const validTo = validToRaw ? new Date(validToRaw).toISOString() : null;
    this.api
      .setResellerWholesale(this.resellerId(), {
        productId,
        priceCents,
        validFrom,
        validTo,
      })
      .subscribe({
        next: () => {
          toast.success('Vigência de atacado registrada.');
          form.reset();
          this.reload();
        },
        error: () => toast.error('Não foi possível gravar o atacado.'),
      });
  }
}
