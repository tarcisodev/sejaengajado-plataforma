import { PlatformLocation } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { AdminSection, adminSection } from './admin-section';
import { AdminConfigComponent } from './admin-config.component';
import { AdminCouponsComponent } from './admin-coupons.component';
import { AdminCustomersComponent } from './admin-customers.component';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminPlansComponent } from './admin-plans.component';
import { AdminResellersComponent } from './admin-resellers.component';
import { AdminRevenueComponent } from './admin-revenue.component';
import { AdminSitesComponent } from './admin-sites.component';

@Component({
  selector: 'app-admin-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    AdminDashboardComponent,
    AdminCustomersComponent,
    AdminResellersComponent,
    AdminSitesComponent,
    AdminPlansComponent,
    AdminConfigComponent,
    AdminCouponsComponent,
    AdminRevenueComponent,
  ],
  templateUrl: './admin-shell.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent {
  private readonly location = inject(PlatformLocation);
  private readonly router = inject(Router);
  readonly section = signal<AdminSection>(adminSection(this.location.pathname));

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.section.set(adminSection(this.location.pathname));
    });
  }
}
