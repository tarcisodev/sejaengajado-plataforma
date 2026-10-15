import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmSkeleton } from '@spartan-ng/helm/skeleton';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { API_PORT } from '../../core/api/api-port';
import { Customer } from '../../core/models/domain';

@Component({
  selector: 'app-admin-customers',
  imports: [NgIcon, HlmCardImports, HlmInput, HlmSkeleton, HlmTableImports],
  providers: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './admin-customers.component.html',
})
export class AdminCustomersComponent {
  private readonly api = inject(API_PORT);
  readonly query = signal('');
  readonly ready = signal(false);
  readonly rows = signal<Customer[]>([]);
  readonly placeholders = [1, 2, 3];
  private resellers = new Map<string, string>();

  constructor() {
    this.api.listResellers().subscribe((list) => {
      this.resellers = new Map(list.map((reseller) => [reseller.id, reseller.nome]));
    });
    this.api.listCustomers().subscribe((rows) => {
      this.rows.set(rows);
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
    return this.resellers.get(resellerId) ?? resellerId;
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
