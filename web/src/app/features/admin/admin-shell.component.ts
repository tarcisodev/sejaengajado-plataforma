import { PlatformLocation } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBadgeDollarSign,
  lucideCreditCard,
  lucideGlobe,
  lucideHouse,
  lucideMoon,
  lucideQrCode,
  lucideSettings,
  lucideStore,
  lucideSun,
  lucideFileText,
  lucideTicket,
  lucideUsers,
  lucideWallet,
} from '@ng-icons/lucide';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import {
  HlmSidebarImports,
  HlmSidebarService,
  provideHlmSidebarConfig,
} from '@spartan-ng/helm/sidebar';
import { filter } from 'rxjs';

import { featureFlags } from '../../core/api/feature-flags';
import { AuthService } from '../../core/auth/auth.service';
import { BrandMarkComponent } from '../../core/brand/brand-mark.component';
import { ThemeService } from '../../core/theme/theme.service';
import { AdminSection, adminSection } from './admin-section';
import { AdminConfigComponent } from './admin-config.component';
import { AdminCouponsComponent } from './admin-coupons.component';
import { AdminCustomersComponent } from './admin-customers.component';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminPlaquesComponent } from './admin-plaques.component';
import { AdminPlansComponent } from './admin-plans.component';
import { AdminResellersComponent } from './admin-resellers.component';
import { AdminWholesaleComponent } from './admin-wholesale.component';
import { MyInvoicesComponent } from '../billing/my-invoices.component';
import { AdminRevenueComponent } from './admin-revenue.component';
import { AdminSitesComponent } from './admin-sites.component';

@Component({
  selector: 'app-admin-shell',
  imports: [
    RouterLink,
    NgIcon,
    BrandMarkComponent,
    HlmAvatarImports,
    HlmButton,
    HlmDropdownMenuImports,
    HlmSidebarImports,
    HlmToaster,
    AdminDashboardComponent,
    AdminCustomersComponent,
    AdminResellersComponent,
    AdminWholesaleComponent,
    AdminPlaquesComponent,
    AdminSitesComponent,
    AdminPlansComponent,
    AdminConfigComponent,
    AdminCouponsComponent,
    AdminRevenueComponent,
    MyInvoicesComponent,
  ],
  providers: [
    provideHlmSidebarConfig({
      mobileBreakpoint: '1023px',
      closeMobileSidebarOnMenuButtonClick: true,
    }),
    HlmSidebarService,
    provideIcons({
      lucideBadgeDollarSign,
      lucideCreditCard,
      lucideFileText,
      lucideGlobe,
      lucideHouse,
      lucideMoon,
      lucideQrCode,
      lucideSettings,
      lucideStore,
      lucideSun,
      lucideTicket,
      lucideUsers,
      lucideWallet,
    }),
  ],
  templateUrl: './admin-shell.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminShellComponent {
  private readonly location = inject(PlatformLocation);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly section = signal<AdminSection>(adminSection(this.location.pathname));
  readonly nav = (
    [
      { section: 'inicio', href: '/admin', label: 'Início', icon: 'lucideHouse' },
      { section: 'clientes', href: '/admin/clientes', label: 'Clientes', icon: 'lucideUsers' },
      {
        section: 'revendedores',
        href: '/admin/revendedores',
        label: 'Revendedores',
        icon: 'lucideStore',
      },
      {
        section: 'atacado',
        href: '/admin/atacado',
        label: 'Atacado',
        icon: 'lucideBadgeDollarSign',
      },
      { section: 'sites', href: '/admin/sites', label: 'Sites', icon: 'lucideGlobe' },
      { section: 'planos', href: '/admin/planos', label: 'Planos', icon: 'lucideCreditCard' },
      {
        section: 'configuracoes',
        href: '/admin/configuracoes',
        label: 'Configurações',
        icon: 'lucideSettings',
      },
      { section: 'placas', href: '/admin/placas', label: 'Placas', icon: 'lucideQrCode' },
      { section: 'cupons', href: '/admin/cupons', label: 'Cupons', icon: 'lucideTicket' },
      { section: 'receita', href: '/admin/receita', label: 'Receita', icon: 'lucideWallet' },
      {
        section: 'faturas',
        href: '/admin/faturas',
        label: 'Minhas faturas',
        icon: 'lucideFileText',
      },
    ] as {
      section: AdminSection;
      href: string;
      label: string;
      icon: string;
    }[]
  ).filter((item) => sectionEnabled(item.section));

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const next = adminSection(this.location.pathname);
      this.section.set(sectionEnabled(next) ? next : (this.nav[0]?.section ?? 'revendedores'));
    });
    const current = this.section();
    if (!sectionEnabled(current)) {
      this.section.set(this.nav[0]?.section ?? 'revendedores');
    }
  }

  title(): string {
    return this.nav.find((item) => item.section === this.section())?.label ?? 'Início';
  }

  leave(): void {
    void this.auth.signOut();
  }
}

function sectionEnabled(section: AdminSection): boolean {
  switch (section) {
    case 'inicio':
      return featureFlags.adminDashboard;
    case 'clientes':
      return featureFlags.adminCustomers;
    case 'sites':
      return featureFlags.adminSites;
    case 'receita':
      return featureFlags.adminRevenue;
    case 'faturas':
      return featureFlags.adminFaturas;
    default:
      return true;
  }
}
