import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInput } from '@spartan-ng/helm/input';

import { AuthService } from '../../core/auth/auth.service';
import { ensureSupabaseBrowser } from '../../core/auth/supabase-browser';

@Component({
  selector: 'app-mfa',
  imports: [NgIcon, HlmAlertImports, HlmButton, HlmCardImports, HlmFieldImports, HlmInput],
  providers: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'block w-full max-w-md' },
  templateUrl: './mfa.component.html',
})
export class MfaComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly qr = signal<string | null>(null);
  readonly secret = signal<string | null>(null);
  readonly factorId = signal<string | null>(null);
  readonly code = signal('');
  readonly error = signal('');
  readonly pending = signal(false);
  readonly enrolled = signal(false);

  async ngOnInit(): Promise<void> {
    await this.auth.ensureReady();
    if (!this.auth.me()) {
      await this.router.navigateByUrl('/entrar');
      return;
    }
    await this.prepareFactor();
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async verify(event: Event): Promise<void> {
    event.preventDefault();
    const factorId = this.factorId();
    const token = this.code().trim();
    if (!factorId || !token) {
      this.error.set('Informe o código do autenticador.');
      return;
    }
    this.pending.set(true);
    this.error.set('');
    try {
      const sb = await ensureSupabaseBrowser();
      if (!sb) {
        throw new Error('Supabase indisponível');
      }
      const challenge = await sb.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) {
        throw challenge.error ?? new Error('Falha no desafio MFA');
      }
      const verified = await sb.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: token,
      });
      if (verified.error) {
        throw verified.error;
      }
      const me = await this.auth.refreshMe();
      await this.router.navigateByUrl(this.auth.homePathForRole(me.role));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Código MFA inválido.');
    } finally {
      this.pending.set(false);
    }
  }

  private async prepareFactor(): Promise<void> {
    const sb = await ensureSupabaseBrowser();
    if (!sb) {
      this.error.set('Supabase indisponível.');
      return;
    }
    const factors = await sb.auth.mfa.listFactors();
    const verified = factors.data?.totp?.find((f) => f.status === 'verified');
    if (verified) {
      this.factorId.set(verified.id);
      this.enrolled.set(true);
      return;
    }
    const { data, error } = await sb.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Seja Engajado',
    });
    if (error || !data) {
      this.error.set(error?.message ?? 'Não foi possível iniciar o MFA.');
      return;
    }
    this.factorId.set(data.id);
    this.qr.set(data.totp.qr_code);
    this.secret.set(data.totp.secret);
    this.enrolled.set(false);
  }
}
