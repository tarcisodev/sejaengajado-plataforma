import { TestBed } from '@angular/core/testing';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { formatBrl } from '../landing/landing-seo';
import { MyInvoicesComponent } from './my-invoices.component';

describe('MyInvoicesComponent', () => {
  it('lists pending, paid and overdue with API centavos', async () => {
    TestBed.configureTestingModule({
      imports: [MyInvoicesComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const fixture = TestBed.createComponent(MyInvoicesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).replace(/\u00a0/g, ' ');
    expect(text).toContain('OPEN');
    expect(text).toContain('PAID');
    expect(text).toContain('OVERDUE');
    expect(text).toContain(formatBrl(6_970).replace(/\u00a0/g, ' '));
    expect(text).toContain(formatBrl(4_990).replace(/\u00a0/g, ' '));
    expect(text).toContain(formatBrl(5_980).replace(/\u00a0/g, ' '));
  });

  it('copies Pix from detail', async () => {
    TestBed.configureTestingModule({
      imports: [MyInvoicesComponent],
      providers: [MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    });
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const fixture = TestBed.createComponent(MyInvoicesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pending = fixture.componentInstance.invoices().find((row) => row.status === 'OPEN')!;
    fixture.componentInstance.open(pending);
    fixture.detectChanges();
    await fixture.componentInstance.copyPix();
    expect(writeText).toHaveBeenCalledWith('00020126MOCKPIXCOPIACOLA');
  });
});
