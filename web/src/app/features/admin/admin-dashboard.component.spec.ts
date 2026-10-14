import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { toCivilDate } from '../../core/api/plaque-penalty';
import { MockApiService } from '../../mocks/mock-api.service';
import { formatBrl } from '../landing/landing-seo';
import { AdminDashboardComponent } from './admin-dashboard.component';

describe('AdminDashboardComponent', () => {
  it('counts month revenue, active sites, recurring MRR and delinquent resellers', async () => {
    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const api = TestBed.inject(MockApiService);
    const [payments, sites, plans, resellers] = await Promise.all([
      firstValueFrom(api.listPayments()),
      firstValueFrom(api.listSites()),
      firstValueFrom(api.listPlans()),
      firstValueFrom(api.listResellers()),
    ]);
    const month = toCivilDate(new Date()).slice(0, 7);
    const active = sites.filter(
      (site) => site.status === 'PUBLISHED' || site.status === 'READ_ONLY',
    );
    const recurring = new Set(
      plans.filter((plan) => plan.tipo === 'RECURRING').map((plan) => plan.id),
    );
    const price = new Map(plans.map((plan) => [plan.id, plan.precoCentavos]));
    const revenue = payments
      .filter((payment) => payment.status === 'PAID' && payment.paidAt?.startsWith(month))
      .reduce((sum, payment) => sum + payment.valor, 0);
    const mrr = active
      .filter((site) => recurring.has(site.planId))
      .reduce((sum, site) => sum + (price.get(site.planId) ?? 0), 0);

    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).replace(/\u00a0/g, ' ');

    expect(text).toContain(formatBrl(revenue).replace(/\u00a0/g, ' '));
    expect(fixture.nativeElement.querySelector('[data-active-sites]')?.textContent).toBe(
      String(active.length),
    );
    expect(
      fixture.nativeElement.querySelector('[data-mrr]')?.textContent?.replace(/\u00a0/g, ' '),
    ).toBe(formatBrl(mrr).replace(/\u00a0/g, ' '));
    expect(fixture.nativeElement.querySelector('[data-delinquent]')?.textContent).toBe(
      String(resellers.filter((reseller) => reseller.status === 'DELINQUENT').length),
    );
  });
});
