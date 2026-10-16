import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/** Magic link / PKCE: o SDK lê a URL; depois redirecionamos pelo papel. */
@Component({
  selector: 'app-auth-callback',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <main class="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <p class="text-sm text-muted-foreground">{{ message() }}</p>
    </main>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly message = signal('Confirmando sessão…');

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.ensureReady();
      const me = this.auth.me() ?? (await this.auth.refreshMe());
      await this.router.navigateByUrl(this.auth.homePathForRole(me.role));
    } catch {
      this.message.set('Não foi possível confirmar o login.');
      await this.router.navigateByUrl('/entrar');
    }
  }
}
