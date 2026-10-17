import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import type { PlaqueMovementDto, PlaqueStockRowDto } from '../../core/api/admin-api.types';
import { API_PORT } from '../../core/api/api-port';
import { Reseller } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

export function plaqueTypeLabel(type: string): string {
  if (type === 'NFC') {
    return 'NFC + QR Code';
  }
  if (type === 'QR') {
    return 'QR Code';
  }
  return type;
}

@Component({
  selector: 'app-admin-plaques',
  imports: [DatePipe, HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-plaques.component.html',
})
export class AdminPlaquesComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly plaqueLabel = plaqueTypeLabel;
  readonly resellers = signal<Reseller[]>([]);
  readonly resellerId = signal('');
  readonly moveDirection = signal<'IN' | 'OUT'>('IN');
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

  onDirection(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.moveDirection.set(val === 'OUT' ? 'OUT' : 'IN');
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
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const direction = String(data.get('direction') ?? this.moveDirection()) === 'OUT' ? 'OUT' : 'IN';
    const rawType = String(data.get('plaqueType') ?? 'NFC');
    const types: ('QR' | 'NFC')[] = rawType === 'BOTH' ? ['NFC', 'QR'] : [rawType === 'QR' ? 'QR' : 'NFC'];
    const qty = Number(data.get('qty') ?? 0);
    const unitCostCents =
      direction === 'IN' ? Number(data.get('unitCostCents') ?? 0) || undefined : undefined;
    const reason =
      String(data.get('reason') ?? '').trim() ||
      (direction === 'OUT' ? 'ajuste_admin_saida' : 'ajuste_admin_entrada');

    const calls = types.map((plaqueType) =>
      this.api.postAdminPlaqueMovement(
        {
          resellerId: this.resellerId(),
          type: direction,
          plaqueType,
          qty,
          unitCostCents,
          reason,
        },
        crypto.randomUUID(),
      ),
    );

    forkJoin(calls).subscribe({
      next: () => {
        toast.success(
          direction === 'OUT' ? 'Estoque subtraído.' : 'Estoque adicionado.',
        );
        form.reset();
        this.moveDirection.set('IN');
        this.reload();
      },
      error: (err: { error?: { code?: string } }) => {
        if (err?.error?.code === 'STOCK_INSUFFICIENT') {
          toast.error('Saldo insuficiente no estoque do vendedor para subtrair essa quantidade.');
          return;
        }
        toast.error('Falha ao atualizar o estoque.');
      },
    });
  }

  transfer(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const rawType = String(data.get('plaqueType') ?? 'NFC');
    const types: ('QR' | 'NFC')[] = rawType === 'BOTH' ? ['NFC', 'QR'] : [rawType === 'QR' ? 'QR' : 'NFC'];
    const toResellerId = String(data.get('toResellerId') ?? '');
    const qty = Number(data.get('qty') ?? 0);

    forkJoin(
      types.map((plaqueType) =>
        this.api.transferPlaques({ toResellerId, plaqueType, qty }, crypto.randomUUID()),
      ),
    ).subscribe({
      next: () => {
        toast.success('Transferência concluída.');
        form.reset();
        this.reload();
      },
      error: () => toast.error('Falha na transferência.'),
    });
  }
}
