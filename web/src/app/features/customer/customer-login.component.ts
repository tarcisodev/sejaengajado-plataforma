import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

import { API_PORT } from '../../core/api/api-port';
import { ThemeService } from '../../core/theme/theme.service';
import { CustomerSession } from './customer-session';

@Component({
  selector: 'app-customer-login',
  imports: [NgIcon, HlmAlertImports, HlmButton, HlmCardImports, HlmFieldImports, HlmInput],
  providers: [provideIcons({ lucideMoon, lucideSun, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'block w-full max-w-sm' },
  templateUrl: './customer-login.component.html',
})
export class CustomerLoginComponent {
  private readonly api = inject(API_PORT);
  private readonly router = inject(Router);
  private readonly session = inject(CustomerSession);
  readonly theme = inject(ThemeService);

  readonly email = signal('');
  readonly code = signal('');
  readonly previewCode = signal<string | null>(null);
  readonly error = signal('');
  readonly pending = signal(false);

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
    this.pending.set(true);
    this.api.requestCustomerOtp(email).subscribe({
      next: (otp) => {
        this.previewCode.set(otp.previewCode);
        this.error.set(
          otp.delivered ? '' : 'Não encontramos uma conta de cliente com esse e-mail.',
        );
        this.pending.set(false);
      },
      error: () => this.pending.set(false),
    });
  }

  verify(event: Event): void {
    event.preventDefault();
    if (!this.code().trim()) {
      this.error.set('Informe o código.');
      return;
    }
    this.pending.set(true);
    try {
      this.api.verifyCustomerOtp(this.email(), this.code()).subscribe({
        next: (user) => {
          this.pending.set(false);
          this.session.enter(user);
          void this.router.navigateByUrl('/conta');
        },
        error: () => this.pending.set(false),
      });
    } catch {
      this.pending.set(false);
      this.error.set('Código inválido.');
    }
  }
}
