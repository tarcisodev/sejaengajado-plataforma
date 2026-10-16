import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';

import type { PlaqueMovementDto, PlaqueStockRowDto } from '../../core/api/admin-api.types';
import { API_PORT } from '../../core/api/api-port';
import { Reseller } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-admin-plaques',
  imports: [DatePipe, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-plaques.component.html',
})
export class AdminPlaquesComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly resellers = signal<Reseller[]>([]);
  readonly resellerId = signal('');
  readonly stock = signal<PlaqueStockRowDto[]>([]);
  readonly movements = signal<PlaqueMovementDto[]>([]);

  constructor() {
    this.api.listResellers().subscribe((rows) => {
      this.resellers.set(rows);
      if (rows[0]) {
        this.resellerId.set(rows[0].id);
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
    this.api.getAdminPlaqueStock(id).subscribe((stock) => this.stock.set(stock));
    this.api.listAdminPlaqueMovements(id).subscribe((page) => this.movements.set(page.items));
  }

  moveIn(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const key = crypto.randomUUID();
    this.api
      .postAdminPlaqueMovement(
        {
          resellerId: this.resellerId(),
          type: 'IN',
          plaqueType: String(data.get('plaqueType') ?? 'QR') as 'QR' | 'NFC',
          qty: Number(data.get('qty') ?? 0),
          unitCostCents: Number(data.get('unitCostCents') ?? 0) || undefined,
          reason: String(data.get('reason') ?? '') || undefined,
        },
        key,
      )
      .subscribe({
        next: () => {
          toast.success('Entrada registrada.');
          (event.target as HTMLFormElement).reset();
          this.reload();
        },
        error: () => toast.error('Falha na entrada de estoque.'),
      });
  }

  transfer(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const key = crypto.randomUUID();
    this.api
      .transferPlaques(
        {
          toResellerId: String(data.get('toResellerId') ?? ''),
          plaqueType: String(data.get('plaqueType') ?? 'QR') as 'QR' | 'NFC',
          qty: Number(data.get('qty') ?? 0),
        },
        key,
      )
      .subscribe({
        next: () => {
          toast.success('Transferência concluída.');
          (event.target as HTMLFormElement).reset();
          this.reload();
        },
        error: () => toast.error('Falha na transferência.'),
      });
  }
}
