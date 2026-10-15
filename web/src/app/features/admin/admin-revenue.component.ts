import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Payment, Reseller, ResellerInvoice, Site } from '../../core/models/domain';
import { formatBrl } from '../landing/landing-seo';

@Component({
  selector: 'app-admin-revenue',
  imports: [HlmButton, HlmCardImports, HlmInput, HlmSelectImports, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-revenue.component.html',
})
export class AdminRevenueComponent {
  private readonly api = inject(API_PORT);
  readonly formatBrl = formatBrl;
  readonly from = signal('2026-01-01');
  readonly to = signal('2026-12-31');
  readonly resellerId = signal('all');
  readonly payments = signal<Payment[]>([]);
  readonly resellers = signal<Reseller[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly invoice = signal<ResellerInvoice | null>(null);
  readonly closeResellerId = signal('');
  readonly closeMonth = signal('2026-10');

  constructor() {
    forkJoin({
      payments: this.api.listPayments(),
      resellers: this.api.listResellers(),
      sites: this.api.listSites(),
    }).subscribe(({ payments, resellers, sites }) => {
      this.payments.set(payments);
      this.resellers.set(resellers);
      this.sites.set(sites);
      this.closeResellerId.set(resellers[0]?.id ?? '');
    });
  }

  visible(): Payment[] {
    const from = this.from();
    const to = this.to();
    const resellerId = this.resellerId();
    return this.payments().filter((payment) => {
      const day = (payment.paidAt ?? '').slice(0, 10);
      const inPeriod = day >= from && day <= to;
      const matches =
        resellerId === 'all' ||
        (resellerId === 'direct' ? payment.resellerId === null : payment.resellerId === resellerId);
      return payment.status === 'PAID' && inPeriod && matches;
    });
  }

  total(): number {
    return this.visible().reduce((sum, payment) => sum + payment.valor, 0);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  readonly resellerLabel = (value: string | null): string => {
    if (value === 'all') {
      return 'Todos';
    }
    if (value === 'direct') {
      return 'Venda direta';
    }
    return this.resellers().find((reseller) => reseller.id === value)?.nome ?? '';
  };

  setReseller(value: string | null | undefined): void {
    this.resellerId.set(value || 'all');
  }

  setCloseReseller(value: string | null | undefined): void {
    if (value) {
      this.closeResellerId.set(value);
    }
  }

  siteName(siteId: string): string {
    return this.sites().find((site) => site.id === siteId)?.content.businessName ?? siteId;
  }

  close(): void {
    const resellerId = this.closeResellerId();
    if (!resellerId) {
      return;
    }
    this.api
      .closeResellerInvoice(resellerId, this.closeMonth(), `${this.closeMonth()}-28`)
      .subscribe((invoice) => this.invoice.set(invoice));
  }
}
