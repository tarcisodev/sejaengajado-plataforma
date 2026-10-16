import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { formatBrl } from '../landing/landing-seo';
import {
  ResellerSalesComponent,
  brlInputToCents,
  centsToBrlInput,
} from './reseller-sales.component';

describe('brlInputToCents', () => {
  it('parses pt-BR reais into integer cents', () => {
    expect(brlInputToCents('12,90')).toBe(1290);
    expect(brlInputToCents('1.234,56')).toBe(123456);
    expect(brlInputToCents('10')).toBe(1000);
    expect(centsToBrlInput(1290)).toBe('12,90');
  });
});

describe('ResellerSalesComponent (AW4)', () => {
  const wholesaleItem = {
    productId: 'prod-qr',
    code: 'PLAQUE_QR',
    name: 'Placa QR',
    baseWholesaleCents: 100,
    priceCents: 150,
  };

  function setup(recordImpl?: jasmine.Spy) {
    const recordSpy =
      recordImpl ??
      jasmine.createSpy('recordResellerSale').and.returnValue(
        of({
          id: 'sale-1',
          resellerId: 'r1',
          createdAt: '2026-10-16T12:00:00.000Z',
          predictedMarginCents: 850,
          items: [
            {
              productId: 'prod-qr',
              qty: 1,
              unitCostCents: 150,
              unitPriceCents: 1000,
            },
          ],
        }),
      );

    TestBed.configureTestingModule({
      imports: [ResellerSalesComponent],
      providers: [
        {
          provide: API_PORT,
          useValue: {
            listResellerSales: () => of({ items: [], nextCursor: null }),
            listResellerWholesale: () => of({ items: [wholesaleItem] }),
            listResellerPrices: () =>
              of({
                items: [
                  {
                    productId: 'prod-qr',
                    code: 'PLAQUE_QR',
                    name: 'Placa QR',
                    priceCents: 1000,
                  },
                ],
              }),
            recordResellerSale: recordSpy,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ResellerSalesComponent);
    fixture.detectChanges();
    return { fixture, recordSpy };
  }

  it('shows frozen cost and price in BRL from cents', () => {
    const { fixture } = setup();
    const text = (fixture.nativeElement as HTMLElement)
      .querySelector('[data-sale-frozen]')!
      .textContent!.replace(/\u00a0/g, ' ');
    expect(text).toContain(formatBrl(150).replace(/\u00a0/g, ' '));
    expect(text).toContain(formatBrl(1000).replace(/\u00a0/g, ' '));
    expect(text).toContain('Placa QR');
  });

  it('shows live margin as price − cost in cents (FF5)', () => {
    const { fixture } = setup();
    // qty 1 × (1000 − 150) = 850
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-margin]')!
        .textContent!.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(850).replace(/\u00a0/g, ' '));
    fixture.componentInstance.qty.set(2);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-margin]')!
        .textContent!.replace(/\u00a0/g, ' '),
    ).toContain(formatBrl(1700).replace(/\u00a0/g, ' '));
  });

  it('reuses one Idempotency-Key when submit is clicked twice while in-flight', () => {
    const pending = new Subject<unknown>();
    const recordSpy = jasmine
      .createSpy('recordResellerSale')
      .and.returnValue(pending.asObservable());
    const { fixture } = setup(recordSpy);
    const form = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-sale-form]',
    ) as HTMLFormElement;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(recordSpy).toHaveBeenCalledTimes(1);
    const key = recordSpy.calls.mostRecent().args[1] as string;
    expect(key.length).toBeGreaterThan(10);
    const submit = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-sale-submit]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    pending.next({
      id: 'sale-1',
      resellerId: 'r1',
      createdAt: '2026-10-16T12:00:00.000Z',
      predictedMarginCents: 850,
      items: [],
    });
    pending.complete();
    fixture.detectChanges();
  });
});
