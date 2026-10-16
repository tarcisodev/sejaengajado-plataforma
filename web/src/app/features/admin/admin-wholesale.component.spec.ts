import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { AdminWholesaleComponent } from './admin-wholesale.component';

describe('AdminWholesaleComponent', () => {
  let fixture: ComponentFixture<AdminWholesaleComponent>;
  let api: MockApiService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminWholesaleComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    api = TestBed.inject(MockApiService);
    fixture = TestBed.createComponent(AdminWholesaleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('submits wholesale price in cents with ISO dates', async () => {
    const products = await firstValueFrom(api.listAdminProducts());
    const resellerId = fixture.componentInstance.resellerId();
    const form = fixture.nativeElement.querySelector('[data-wholesale-form]') as HTMLFormElement;
    const productSelect = form.querySelector('select[name="productId"]') as HTMLSelectElement;
    const price = form.querySelector('input[name="priceCents"]') as HTMLInputElement;
    const from = form.querySelector('input[name="validFrom"]') as HTMLInputElement;
    const to = form.querySelector('input[name="validTo"]') as HTMLInputElement;

    productSelect.value = products[0].id;
    productSelect.dispatchEvent(new Event('change'));
    price.value = '1990';
    price.dispatchEvent(new Event('input'));
    from.value = '2026-10-15T10:00';
    from.dispatchEvent(new Event('input'));
    to.value = '2026-11-15T10:00';
    to.dispatchEvent(new Event('input'));

    const setSpy = spyOn(api, 'setResellerWholesale').and.callThrough();
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(setSpy).toHaveBeenCalled();
    const [, body] = setSpy.calls.mostRecent().args;
    expect(body.productId).toBe(products[0].id);
    expect(body.priceCents).toBe(1990);
    expect(body.validFrom).toContain('2026-10-15');
    expect(body.validTo).toContain('2026-11-15');
    expect(resellerId).toBeTruthy();
  });
});
