import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { formatBrl } from '../landing/landing-seo';
import { ResellerDashboardComponent } from './reseller-dashboard.component';

describe('ResellerDashboardComponent (FF5)', () => {
  it('shows payable total and invoice lines from cents', () => {
    TestBed.configureTestingModule({
      imports: [ResellerDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: API_PORT,
          useValue: {
            getResellerDashboard: () =>
              of({
                activeSites: 2,
                monthSalesCents: 10_000,
                predictedMarginCents: 2_500,
                realizedMarginCents: 1_800,
                balanceCents: 5_000,
                stock: [{ plaqueType: 'QR', qty: 3 }],
                openInvoice: {
                  id: 'inv-1',
                  period: '2026-10',
                  totalCents: 3_900,
                  status: 'OPEN',
                  lines: [
                    {
                      description: 'Mensalidade',
                      qty: 1,
                      unitCents: 2_000,
                      totalCents: 2_000,
                    },
                    {
                      description: 'Atacado / placas',
                      qty: 1,
                      unitCents: 1_900,
                      totalCents: 1_900,
                    },
                  ],
                },
                monthFrom: '2026-10-01T03:00:00.000Z',
                monthToExclusive: '2026-11-01T03:00:00.000Z',
              }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ResellerDashboardComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-amount-due]')).toBeTruthy();
    expect(
      root.querySelector('[data-open-invoice-total]')!.textContent!.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(3900).replace(/\u00a0/g, ' '));
    expect(root.querySelector('[data-invoice-lines]')!.textContent).toContain('Mensalidade');
    expect(
      root.querySelector('[data-predicted-margin]')!.textContent!.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(2500).replace(/\u00a0/g, ' '));
  });
});
