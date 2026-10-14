import { TestBed } from '@angular/core/testing';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { formatBrl } from '../landing/landing-seo';
import { AdminRevenueComponent } from './admin-revenue.component';

describe('AdminRevenueComponent', () => {
  it('stores the closing snapshot of published and read-only sites', async () => {
    TestBed.configureTestingModule({
      imports: [AdminRevenueComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const fixture = TestBed.createComponent(AdminRevenueComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.closeResellerId.set('res_triangulo');
    fixture.componentInstance.closeMonth.set('2026-10');
    fixture.componentInstance.close();
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).replace(/\u00a0/g, ' ');

    expect(text).toContain('Salão da Ana');
    expect(text).toContain('Salão da Ana Unidades');
    expect(
      fixture.nativeElement
        .querySelector('[data-invoice-total]')
        ?.textContent?.replace(/\u00a0/g, ' '),
    ).toBe(formatBrl(4990 + 2 * 990).replace(/\u00a0/g, ' '));
  });
});
