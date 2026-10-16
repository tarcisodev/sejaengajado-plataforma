import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { formatBrl } from '../landing/landing-seo';
import { ResellerStockComponent } from './reseller-stock.component';

describe('ResellerStockComponent (AW5)', () => {
  it('lists PlaqueStock with avg cost in BRL and records IN with Idempotency-Key', () => {
    const record = jasmine.createSpy('recordResellerPlaqueMovement').and.returnValue(
      of({
        id: 'm1',
        resellerId: 'r1',
        type: 'IN',
        plaqueType: 'QR',
        qty: 2,
        unitCostCents: 1300,
        siteId: null,
        reason: 'compra',
        createdAt: '2026-10-16T12:00:00.000Z',
      }),
    );

    TestBed.configureTestingModule({
      imports: [ResellerStockComponent],
      providers: [
        {
          provide: API_PORT,
          useValue: {
            listResellerPlaqueStock: () =>
              of({
                items: [{ plaqueType: 'QR', qty: 40, avgCostCents: 1300 }],
              }),
            listResellerPlaqueMovements: () => of({ items: [], nextCursor: null }),
            listResellerSites: () => of({ items: [], nextCursor: null }),
            recordResellerPlaqueMovement: record,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ResellerStockComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-stock-qty="QR"]')!.textContent!.trim()).toBe('40');
    expect(
      root.querySelector('[data-plaque-stock]')!.textContent!.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(1300).replace(/\u00a0/g, ' '));

    const form = root.querySelector('[data-stock-in-form]') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(record).toHaveBeenCalledTimes(1);
    const [body, key] = record.calls.mostRecent().args;
    expect(body).toEqual(
      jasmine.objectContaining({ type: 'IN', plaqueType: 'QR', qty: 1, unitCostCents: 1300 }),
    );
    expect(typeof key).toBe('string');
    expect((key as string).length).toBeGreaterThan(10);
  });
});
