import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

import { AuthService } from '../../core/auth/auth.service';
import { BrandMarkComponent } from '../../core/brand/brand-mark.component';
import { ThemeService } from '../../core/theme/theme.service';
import { LegalAcceptComponent } from '../legal/legal-accept.component';

@Component({
  selector: 'app-login',
  imports: [
    NgIcon,
    BrandMarkComponent,
    HlmAlertImports,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInput,
    LegalAcceptComponent,
  ],
  providers: [provideIcons({ lucideMoon, lucideSun, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'block w-full max-w-sm' },
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly devMailpit = isDevMode();
  readonly email = signal('');
  readonly code = signal('');
  readonly codeSent = signal(false);
  readonly error = signal('');
  readonly pending = signal(false);
  readonly legalAccepted = signal(false);

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
    if (!this.legalAccepted()) {
      this.error.set('Aceite os termos e políticas para continuar.');
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
    if (!this.legalAccepted()) {
      this.error.set('Aceite os termos e políticas para continuar.');
      return;
    }
    const code = this.code().replace(/\D/g, '');
    if (code.length !== 6) {
      this.error.set('Informe o código de 6 dígitos.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    try {
      const me = await this.auth.verifyOtp(this.email(), code);
      await this.router.navigateByUrl(this.auth.homePathForRole(me.role));
    } catch (err) {
      this.error.set(verifyFailureMessage(err));
    } finally {
      this.pending.set(false);
    }
  }
}

function verifyFailureMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: string; message?: string } | null;
    if (body?.code === 'AUTH_NOT_INVITED') {
      return 'O código foi aceito, mas esta conta não está cadastrada na API. Rode o seed do admin local.';
    }
    if (err.status === 0) {
      return 'O código foi aceito, mas a API local não respondeu.';
    }
    if (body?.message) {
      return body.message;
    }
  }
  return 'Código inválido ou expirado. Peça outro e use só o e-mail mais recente.';
}
