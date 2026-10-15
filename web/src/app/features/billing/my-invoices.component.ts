import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { interval, switchMap, takeWhile } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { MyResellerInvoice } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-my-invoices',
  imports: [HlmBadge, HlmButton, HlmCardImports, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './my-invoices.component.html',
})
export class MyInvoicesComponent {
  private readonly api = inject(API_PORT);
  private readonly destroyRef = inject(DestroyRef);

  readonly formatBrl = formatBrl;
  readonly invoices = signal<MyResellerInvoice[]>([]);
  readonly selected = signal<MyResellerInvoice | null>(null);
  readonly copied = signal(false);

  constructor() {
    this.api.listMyInvoices().subscribe((rows) => this.invoices.set(rows));
  }

  open(invoice: MyResellerInvoice): void {
    this.selected.set(invoice);
    this.copied.set(false);
    if (invoice.gatewayPaymentId && invoice.paymentStatus === 'PENDING') {
      this.poll(invoice.gatewayPaymentId, invoice.id);
    }
  }

  async copyPix(): Promise<void> {
    const code = this.selected()?.pixCopyPaste;
    if (!code || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
  }

  private poll(gatewayPaymentId: string, invoiceId: string): void {
    interval(3_000)
      .pipe(
        switchMap(() => this.api.getPaymentStatus(gatewayPaymentId)),
        takeWhile((status) => status.status === 'PENDING' || status.status === 'CONFIRMED', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => {
          const current = this.selected();
          if (!current || current.id !== invoiceId) {
            return;
          }
          this.selected.set({
            ...current,
            paymentStatus: status.status,
            totalCents: status.amountCents,
            invoiceUrl: status.invoiceUrl,
            bankSlipUrl: status.bankSlipUrl,
          });
          this.invoices.update((rows) =>
            rows.map((row) =>
              row.id === invoiceId
                ? {
                    ...row,
                    paymentStatus: status.status,
                    totalCents: status.amountCents,
                  }
                : row,
            ),
          );
        },
      });
  }
}
