import { Component, inject, signal } from '@angular/core';

import { API_PORT } from '../../core/api/api-port';
import { Customer } from '../../core/models/domain';

@Component({
  selector: 'app-admin-customers',
  templateUrl: './admin-customers.component.html',
})
export class AdminCustomersComponent {
  private readonly api = inject(API_PORT);
  readonly query = signal('');
  readonly rows = signal<Customer[]>([]);
  private resellers = new Map<string, string>();

  constructor() {
    this.api.listResellers().subscribe((list) => {
      this.resellers = new Map(list.map((reseller) => [reseller.id, reseller.nome]));
    });
    this.api.listCustomers().subscribe((rows) => this.rows.set(rows));
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
