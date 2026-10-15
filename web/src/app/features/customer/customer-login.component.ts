import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import { CustomerSession } from './customer-session';

@Component({
  selector: 'app-customer-login',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './customer-login.component.html',
})
export class CustomerLoginComponent {
  private readonly api = inject(API_PORT);
  private readonly router = inject(Router);
  private readonly session = inject(CustomerSession);

  readonly email = signal('');
  readonly code = signal('');
  readonly previewCode = signal<string | null>(null);
  readonly error = signal('');

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  request(event: Event): void {
    event.preventDefault();
    const email = this.email().trim();
    if (!email) {
      this.error.set('Informe o e-mail.');
      return;
    }
    this.api.requestCustomerOtp(email).subscribe((otp) => {
      this.previewCode.set(otp.previewCode);
      this.error.set(otp.delivered ? '' : 'Não encontramos uma conta de cliente com esse e-mail.');
    });
  }

  verify(event: Event): void {
    event.preventDefault();
    if (!this.code().trim()) {
      this.error.set('Informe o código.');
      return;
    }
    try {
      this.api.verifyCustomerOtp(this.email(), this.code()).subscribe((user) => {
        this.session.enter(user);
        void this.router.navigateByUrl('/conta');
      });
    } catch {
      this.error.set('Código inválido.');
    }
  }
}
