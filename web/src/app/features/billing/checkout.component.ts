import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { interval, switchMap, takeWhile } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { CheckoutResult, PaymentMethod } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, HlmButton, HlmCardImports, HlmFieldImports, HlmInput, HlmSelectImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  private readonly api = inject(API_PORT);
  private readonly destroyRef = inject(DestroyRef);

  readonly formatBrl = formatBrl;
  readonly siteId = signal('');
  readonly customerName = signal('');
  readonly customerEmail = signal('');
  readonly method = signal<PaymentMethod>('PIX');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<CheckoutResult | null>(null);
  readonly liveStatus = signal<string | null>(null);
  readonly copied = signal(false);

  setMethod(value: string | null | undefined): void {
    if (value === 'PIX' || value === 'BOLETO' || value === 'CARD') {
      this.method.set(value);
    }
  }

  start(): void {
    this.error.set(null);
    this.busy.set(true);
    this.api
      .checkoutPronto(
        {
          siteId: this.siteId().trim(),
          customerName: this.customerName().trim(),
          customerEmail: this.customerEmail().trim(),
          method: this.method(),
        },
        crypto.randomUUID(),
      )
      .subscribe({
        next: (checkout) => {
          this.busy.set(false);
          this.result.set(checkout);
          this.liveStatus.set(checkout.status);
          this.poll(checkout.gatewayPaymentId);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Não foi possível iniciar o checkout. Tente de novo.');
        },
      });
  }

  async copyPix(): Promise<void> {
    const code = this.result()?.pixCopyPaste;
    if (!code || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
  }

  openHostedCard(): void {
    const url = this.result()?.invoiceUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private poll(gatewayPaymentId: string): void {
    interval(3_000)
      .pipe(
        switchMap(() => this.api.getPaymentStatus(gatewayPaymentId)),
        takeWhile((status) => status.status === 'PENDING' || status.status === 'CONFIRMED', true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (status) => {
          this.liveStatus.set(status.status);
          const current = this.result();
          if (current) {
            this.result.set({
              ...current,
              status: status.status,
              amountCents: status.amountCents,
              invoiceUrl: status.invoiceUrl,
              bankSlipUrl: status.bankSlipUrl,
            });
          }
        },
      });
  }
}
