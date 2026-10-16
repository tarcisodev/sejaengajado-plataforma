import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';

import { API_PORT } from '../../core/api/api-port';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmActionComponent } from '../../shared/confirm-action/confirm-action.component';

@Component({
  selector: 'app-reseller-profile',
  imports: [HlmAlert, HlmButton, HlmCardImports, HlmInput, ConfirmActionComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reseller-profile.component.html',
})
export class ResellerProfileComponent {
  private readonly api = inject(API_PORT);
  private readonly auth = inject(AuthService);

  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly nome = signal('');
  readonly document = signal('');
  readonly phone = signal('');
  readonly addressLine = signal('');
  readonly addressCity = signal('');
  readonly addressUf = signal('');
  readonly addressCep = signal('');
  readonly email = signal(this.auth.me()?.email ?? '');

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.getMyResellerProfile().subscribe({
      next: (row) => {
        this.nome.set(row.nome);
        this.document.set(row.document ?? '');
        this.phone.set(row.phone ?? '');
        this.addressLine.set(row.addressLine ?? '');
        this.addressCity.set(row.addressCity ?? '');
        this.addressUf.set(row.addressUf ?? '');
        this.addressCep.set(row.addressCep ?? '');
        this.email.set(row.email ?? this.auth.me()?.email ?? '');
        this.ready.set(true);
      },
      error: () => {
        this.error.set('Não foi possível carregar o perfil.');
        this.ready.set(true);
      },
    });
  }

  save(): void {
    this.busy.set(true);
    this.error.set('');
    this.api
      .patchMyResellerProfile({
        name: this.nome().trim(),
        document: this.document().trim(),
        phone: this.phone().trim(),
        addressLine: this.addressLine().trim(),
        addressCity: this.addressCity().trim(),
        addressUf: this.addressUf().trim(),
        addressCep: this.addressCep().trim(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.message.set('Perfil atualizado.');
          toast.success('Perfil salvo');
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Não foi possível salvar.');
        },
      });
  }

  async requestPasswordReset(): Promise<void> {
    const email = this.email().trim();
    if (!email) {
      this.error.set('E-mail de login indisponível.');
      return;
    }
    try {
      await this.auth.ensureReady();
      await this.auth.requestPasswordReset(email);
      this.message.set('Enviamos um link para redefinir a senha (se a conta existir).');
    } catch {
      this.error.set('Não foi possível solicitar o reset de senha.');
    }
  }
}
