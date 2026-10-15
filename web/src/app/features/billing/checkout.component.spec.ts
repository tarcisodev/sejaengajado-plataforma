import { TestBed } from '@angular/core/testing';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { formatBrl } from '../landing/landing-seo';
import { CheckoutComponent } from './checkout.component';

describe('CheckoutComponent', () => {
  it('shows API amountCents and Pix copy for pending checkout', async () => {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const fixture = TestBed.createComponent(CheckoutComponent);
    const mock = TestBed.inject(MockApiService);
    fixture.detectChanges();

    fixture.componentInstance.siteId.set('site_ze');
    fixture.componentInstance.customerName.set('Zé');
    fixture.componentInstance.customerEmail.set('ze@example.com');
    fixture.componentInstance.method.set('PIX');
    fixture.componentInstance.start();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\u00a0/g, ' ');
    const result = fixture.componentInstance.result();
    expect(result).toBeTruthy();
    expect(
      fixture.nativeElement
        .querySelector('[data-checkout-amount]')
        ?.textContent?.replace(/\u00a0/g, ' '),
    ).toBe(formatBrl(result!.amountCents).replace(/\u00a0/g, ' '));
    expect(text).toContain('PENDING');
    expect(fixture.nativeElement.querySelector('[data-pix-copy]')?.textContent).toContain(
      'MOCKCHECKOUTPIX',
    );

    mock.markCheckoutPaid(result!.gatewayPaymentId);
  });

  it('offers hosted Asaas link for CARD (no card fields)', async () => {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const fixture = TestBed.createComponent(CheckoutComponent);
    fixture.detectChanges();
    fixture.componentInstance.siteId.set('site_ze');
    fixture.componentInstance.customerName.set('Zé');
    fixture.componentInstance.customerEmail.set('ze@example.com');
    fixture.componentInstance.method.set('CARD');
    fixture.componentInstance.start();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-card-hosted]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[autocomplete="cc-number"]')).toBeNull();
  });
});
