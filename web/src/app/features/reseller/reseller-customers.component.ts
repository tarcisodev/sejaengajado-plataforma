import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { API_PORT } from '../../core/api/api-port';
import type { ResellerCustomerDto } from '../../core/api/reseller-api.types';

@Component({
  selector: 'app-reseller-customers',
  imports: [HlmButton, HlmCardImports, HlmInput, HlmTableImports],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section hlmCard class="p-4 md:p-6">
      <h2 class="font-display text-xl">Novo cliente</h2>
      <form class="mt-4 grid gap-3 sm:grid-cols-2" (submit)="create($event)">
        <label class="grid gap-1 text-sm">
          Nome
          <input hlmInput class="h-11" name="name" required />
        </label>
        <label class="grid gap-1 text-sm">
          WhatsApp
          <input hlmInput class="h-11" name="whatsapp" />
        </label>
        <label class="grid gap-1 text-sm">
          Documento
          <input hlmInput class="h-11" name="doc" />
        </label>
        <label class="grid gap-1 text-sm">
          Cidade
          <input hlmInput class="h-11" name="city" />
        </label>
        <div class="sm:col-span-2">
          <button hlmBtn class="h-11" type="submit">Salvar cliente</button>
        </div>
      </form>
    </section>

    <section class="mt-6 overflow-x-auto">
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
    </section>
  `,
})
export class ResellerCustomersComponent {
  private readonly api = inject(API_PORT);
  readonly rows = signal<ResellerCustomerDto[]>([]);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.listResellerCustomers().subscribe((page) => this.rows.set(page.items));
  }

  create(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.api
      .createResellerCustomer({
        name: String(data.get('name') ?? ''),
        whatsapp: String(data.get('whatsapp') ?? ''),
        doc: String(data.get('doc') ?? ''),
        city: String(data.get('city') ?? ''),
      })
      .subscribe(() => {
        toast.success('Cliente criado.');
        (event.target as HTMLFormElement).reset();
        this.reload();
      });
  }
}
