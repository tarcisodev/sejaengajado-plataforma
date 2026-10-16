import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-login',
  imports: [NgIcon, HlmAlertImports, HlmButton, HlmCardImports, HlmFieldImports, HlmInput],
  providers: [provideIcons({ lucideMoon, lucideSun, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'block w-full max-w-sm' },
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly email = signal('');
  readonly code = signal('');
  readonly codeSent = signal(false);
  readonly error = signal('');
  readonly pending = signal(false);

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async request(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.email().trim();
    if (!email) {
      this.error.set('Informe o e-mail.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    try {
      await this.auth.ensureReady();
      await this.auth.signInWithOtp(email);
      this.codeSent.set(true);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível enviar o código.');
    } finally {
      this.pending.set(false);
    }
  }

  async verify(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.code().trim()) {
      this.error.set('Informe o código.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    try {
      const me = await this.auth.verifyOtp(this.email(), this.code());
      await this.router.navigateByUrl(this.auth.homePathForRole(me.role));
    } catch {
      this.error.set('Código inválido.');
    } finally {
      this.pending.set(false);
    }
  }
}
