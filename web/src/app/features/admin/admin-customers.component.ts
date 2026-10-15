import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Customer, Reseller } from '../../core/models/domain';

@Component({
  selector: 'app-admin-customers',
  imports: [
    NgIcon,
    HlmButton,
    HlmCardImports,
    HlmInput,
    HlmSelectImports,
    HlmSkeleton,
    HlmTableImports,
  ],
  providers: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-customers.component.html',
})
export class AdminCustomersComponent {
  private readonly api = inject(API_PORT);
  readonly query = signal('');
  readonly ready = signal(false);
  readonly creating = signal(false);
  readonly rows = signal<Customer[]>([]);
  readonly resellers = signal<Reseller[]>([]);
  readonly resellerId = signal('');
  readonly placeholders = [1, 2, 3];

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({
      rows: this.api.listCustomers(),
      resellers: this.api.listResellers(),
    }).subscribe(({ rows, resellers }) => {
      this.rows.set(rows);
      this.resellers.set(resellers);
      this.ready.set(true);
    });
  }

  visible(): Customer[] {
    const query = this.query().trim().toLowerCase();
    return this.rows().filter((row) => !query || row.nome.toLowerCase().includes(query));
  }

  resellerName(resellerId: string | null): string {
    if (!resellerId) {
      return 'Direto';
    }
    return this.resellers().find((reseller) => reseller.id === resellerId)?.nome ?? resellerId;
  }

  resellerLabel = (value: string | null): string => {
    if (!value) {
      return 'Direto';
    }
    return this.resellerName(value);
  };

  setReseller(value: string | null | undefined): void {
    this.resellerId.set(value ?? '');
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  save(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.api
      .createCustomer({
        nome: String(data.get('nome') ?? ''),
        doc: String(data.get('doc') ?? ''),
        whatsapp: String(data.get('whatsapp') ?? ''),
        cidade: String(data.get('cidade') ?? ''),
        resellerId: this.resellerId() || null,
      })
      .subscribe(() => {
        this.creating.set(false);
        this.resellerId.set('');
        this.reload();
      });
  }
}
