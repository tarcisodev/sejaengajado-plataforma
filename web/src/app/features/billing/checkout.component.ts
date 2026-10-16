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
import { CheckoutResult, PaymentMethod, ShippingQuoteOption } from '../../core/models/domain';
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
  readonly destinationCep = signal('');
  readonly shippingOptions = signal<ShippingQuoteOption[]>([]);
  readonly shippingServiceId = signal<string | null>(null);
  readonly quoting = signal(false);
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

  setShippingService(value: string | null | undefined): void {
    this.shippingServiceId.set(value?.trim() || null);
  }

  quoteShipping(): void {
    this.error.set(null);
    this.shippingOptions.set([]);
    this.shippingServiceId.set(null);
    const cep = this.destinationCep().trim();
    if (!cep) {
      this.error.set('Informe o CEP de entrega da placa.');
      return;
    }
    this.quoting.set(true);
    this.api.quoteShipping(cep).subscribe({
      next: (quote) => {
        this.quoting.set(false);
        this.shippingOptions.set(quote.options);
        if (quote.options[0]) {
          this.shippingServiceId.set(quote.options[0].serviceId);
        }
        if (quote.options.length === 0) {
          this.error.set('Nenhuma opção de frete para este CEP.');
        }
      },
      error: () => {
        this.quoting.set(false);
        this.error.set('Não foi possível cotar o frete. Tente de novo.');
      },
    });
  }

  selectedShipping(): ShippingQuoteOption | null {
    const id = this.shippingServiceId();
    return this.shippingOptions().find((opt) => opt.serviceId === id) ?? null;
  }

  start(): void {
    this.error.set(null);
    const cep = this.destinationCep().trim();
    const serviceId = this.shippingServiceId();
    if (cep && !serviceId) {
      this.error.set('Selecione uma opção de frete ou limpe o CEP.');
      return;
    }
    this.busy.set(true);
    this.api
      .checkoutPronto(
        {
          siteId: this.siteId().trim(),
          customerName: this.customerName().trim(),
          customerEmail: this.customerEmail().trim(),
          method: this.method(),
          destinationCep: cep || undefined,
          shippingServiceId: serviceId ?? undefined,
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
