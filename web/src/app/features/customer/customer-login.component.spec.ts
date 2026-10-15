import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import { MockApiService } from '../../mocks/mock-api.service';
import { CustomerLoginComponent } from './customer-login.component';
import { CustomerSession } from './customer-session';

describe('CustomerLoginComponent', () => {
  const navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);

  beforeEach(() => {
    navigateByUrl.calls.reset();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [CustomerLoginComponent],
      providers: [
        MockApiService,
        { provide: API_PORT, useExisting: MockApiService },
        CustomerSession,
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
  });

  it('shows the simulated code and enters the account', () => {
    const fixture = TestBed.createComponent(CustomerLoginComponent);
    fixture.detectChanges();
    const email = fixture.nativeElement.querySelector('input[type="email"]') as HTMLInputElement;
    email.value = 'forno@example.com';
    email.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-otp]')?.textContent).toBe('482913');

    const code = fixture.nativeElement.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    code.value = '482913';
    code.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelectorAll('form')[1] as HTMLFormElement).requestSubmit();
    fixture.detectChanges();

    expect(TestBed.inject(CustomerSession).user()?.email).toBe('forno@example.com');
    expect(navigateByUrl).toHaveBeenCalledWith('/conta');
  });

  it('rejects an unknown customer email', () => {
    const fixture = TestBed.createComponent(CustomerLoginComponent);
    fixture.detectChanges();
    const email = fixture.nativeElement.querySelector('input[type="email"]') as HTMLInputElement;
    email.value = 'admin@sejaengajado.com.br';
    email.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não encontramos uma conta de cliente');
  });
});
