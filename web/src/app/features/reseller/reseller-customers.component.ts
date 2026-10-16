import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { API_PORT } from '../../core/api/api-port';
import type { ResellerCustomerDto } from '../../core/api/reseller-api.types';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reseller-customers',
  imports: [HlmAlert, HlmButton, HlmCardImports, HlmInput, HlmSkeleton, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (!operable()) {
      <div hlmAlert variant="destructive" class="mb-4" data-customer-locked>
        Conta inadimplente ou bloqueada: não é possível criar clientes.
      </div>
    }
    <section hlmCard class="p-4 md:p-6">
      <h2 class="font-display text-xl">Novo cliente</h2>
      <form class="mt-4 grid gap-3 sm:grid-cols-2" (submit)="create($event)">
        <label class="grid gap-1 text-sm">
          Nome
          <input hlmInput class="h-11" name="name" required [disabled]="!operable()" />
        </label>
        <label class="grid gap-1 text-sm">
          E-mail (convite /conta)
          <input
            hlmInput
            class="h-11"
            name="email"
            type="email"
            required
            [disabled]="!operable()"
          />
        </label>
        <label class="grid gap-1 text-sm">
          WhatsApp
          <input hlmInput class="h-11" name="whatsapp" [disabled]="!operable()" />
        </label>
        <label class="grid gap-1 text-sm">
          Documento
          <input hlmInput class="h-11" name="doc" [disabled]="!operable()" />
        </label>
        <label class="grid gap-1 text-sm">
          Cidade
          <input hlmInput class="h-11" name="city" [disabled]="!operable()" />
        </label>
        <div class="sm:col-span-2">
          <button hlmBtn class="h-11" type="submit" [disabled]="!operable()">Salvar cliente</button>
        </div>
      </form>
    </section>

    <section class="mt-6 overflow-x-auto">
      @if (!ready()) {
        <div class="grid gap-2">
          @for (n of [1, 2, 3]; track n) {
            <div hlmSkeleton class="h-12 w-full rounded-md"></div>
          }
        </div>
      } @else {
        <table hlmTable class="w-full min-w-[32rem]">
          <thead>
            <tr hlmTr>
              <th hlmTh>Nome</th>
              <th hlmTh>Cidade</th>
              <th hlmTh>WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr hlmTr [attr.data-customer-id]="row.id">
                <td hlmTd>{{ row.name }}</td>
                <td hlmTd>{{ row.city }}</td>
                <td hlmTd>{{ row.whatsapp }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class ResellerCustomersComponent {
  private readonly api = inject(API_PORT);
  private readonly auth = inject(AuthService);
  readonly rows = signal<ResellerCustomerDto[]>([]);
  readonly ready = signal(false);
  readonly operable = computed(() => {
    const status = this.auth.me()?.resellerStatus ?? 'ACTIVE';
    return status !== 'DELINQUENT' && status !== 'BLOCKED';
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.ready.set(false);
    this.api.listResellerCustomers().subscribe((page) => {
      this.rows.set(page.items);
      this.ready.set(true);
    });
  }

  create(event: Event): void {
    event.preventDefault();
    if (!this.operable()) {
      return;
    }
    const data = new FormData(event.target as HTMLFormElement);
    this.api
      .createResellerCustomer({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? '').trim().toLowerCase(),
        whatsapp: String(data.get('whatsapp') ?? ''),
        doc: String(data.get('doc') ?? ''),
        city: String(data.get('city') ?? ''),
      })
      .subscribe({
        next: (created) => {
          const link = (created as { inviteActionLink?: string | null }).inviteActionLink;
          toast.success(
            link
              ? 'Cliente convidado. Link de acesso disponível na resposta da API.'
              : 'Cliente criado e convidado por e-mail.',
          );
          (event.target as HTMLFormElement).reset();
          this.reload();
        },
        error: () => toast.error('Não foi possível criar o cliente.'),
      });
  }
}
