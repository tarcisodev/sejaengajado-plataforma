import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
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
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly devMailpit = isDevMode();
  readonly mode = signal<'login' | 'forgot' | 'reset'>('login');
  readonly email = signal('');
  readonly password = signal('');
  readonly newPassword = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal(false);
  readonly legalAccepted = signal(false);

  async ngOnInit(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      (/type=recovery/i.test(window.location.hash) ||
        /type=recovery|mode=reset/i.test(window.location.search))
    ) {
      this.mode.set('reset');
    }
    await this.auth.ensureReady();
    if (this.auth.passwordRecovery()) {
      this.mode.set('reset');
    }
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async signIn(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.error.set('Informe e-mail e senha.');
      return;
    }
    if (!this.legalAccepted()) {
      this.error.set('Aceite os termos e políticas para continuar.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.auth.ensureReady();
      const me = await this.auth.signInWithPassword(email, password);
      const aal = await this.auth.getAuthenticatorAssuranceLevel();
      if (aal === 'aal1') {
        await this.router.navigateByUrl('/mfa');
        return;
      }
      await this.router.navigateByUrl(this.auth.homePathForRole(me.role));
    } catch (err) {
      this.error.set(signInFailureMessage(err));
    } finally {
      this.pending.set(false);
    }
  }

  async requestReset(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.email().trim();
    if (!email) {
      this.error.set('Informe o e-mail.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.auth.ensureReady();
      await this.auth.requestPasswordReset(email);
      this.notice.set('Se a conta existir, enviamos um link para redefinir a senha.');
      this.mode.set('login');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível enviar o link.');
    } finally {
      this.pending.set(false);
    }
  }

  async completeReset(event: Event): Promise<void> {
    event.preventDefault();
    const next = this.newPassword();
    if (!next || next.length < 8) {
      this.error.set('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.auth.ensureReady();
      await this.auth.updatePassword(next);
      this.newPassword.set('');
      const me = this.auth.me() ?? (await this.auth.refreshMe().catch(() => null));
      if (me) {
        const aal = await this.auth.getAuthenticatorAssuranceLevel();
        if (aal === 'aal1') {
          await this.router.navigateByUrl('/mfa');
          return;
        }
        await this.router.navigateByUrl(this.auth.homePathForRole(me.role));
        return;
      }
      this.notice.set('Senha atualizada. Entre com e-mail e a nova senha.');
      this.mode.set('login');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível salvar a nova senha.');
    } finally {
      this.pending.set(false);
    }
  }
}

function signInFailureMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: string; message?: string } | null;
    if (body?.code === 'AUTH_NOT_INVITED') {
      return 'Conta autenticada, mas não cadastrada na API. Peça um novo convite.';
    }
    if (body?.message) {
      return body.message;
    }
  }
  if (err instanceof Error && err.message) {
    if (/invalid login credentials/i.test(err.message)) {
      return 'E-mail ou senha inválidos.';
    }
    return err.message;
  }
  return 'Não foi possível entrar. Confira e-mail e senha.';
}
