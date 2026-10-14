import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { Coupon, Plan } from '../../core/models/domain';

@Component({
  selector: 'app-admin-coupons',
  templateUrl: './admin-coupons.component.html',
})
export class AdminCouponsComponent {
  private readonly api = inject(API_PORT);
  readonly rows = signal<Coupon[]>([]);
  readonly plans = signal<Plan[]>([]);

  constructor() {
    this.reload();
  }

  reload(): void {
    forkJoin({ rows: this.api.listCoupons(), plans: this.api.listPlans() }).subscribe(
      ({ rows, plans }) => {
        this.rows.set(rows);
        this.plans.set(plans);
      },
    );
  }

  save(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    this.api
      .saveCoupon({
        id: '',
        code: String(data.get('code') ?? '')
          .trim()
          .toUpperCase(),
        tipo: String(data.get('tipo')) === 'FIXED' ? 'FIXED' : 'PCT',
        valor: Number(data.get('valor')),
        validade: String(data.get('validade') ?? ''),
        maxUsos: Number(data.get('maxUsos')),
        usos: 0,
        planIds: data.getAll('planId').map(String),
      })
      .subscribe(() => {
        form.reset();
        this.reload();
      });
  }

  remove(couponId: string): void {
    this.api.deleteCoupon(couponId).subscribe(() => this.reload());
  }
}
