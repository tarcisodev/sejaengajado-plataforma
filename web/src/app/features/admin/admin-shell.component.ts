import { PlatformLocation } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCreditCard,
  lucideGlobe,
  lucideHouse,
  lucideMoon,
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

import { ThemeService } from '../../core/theme/theme.service';
import { AdminSection, adminSection } from './admin-section';
import { AdminConfigComponent } from './admin-config.component';
import { AdminCouponsComponent } from './admin-coupons.component';
import { AdminCustomersComponent } from './admin-customers.component';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminPlansComponent } from './admin-plans.component';
import { AdminResellersComponent } from './admin-resellers.component';
import { MyInvoicesComponent } from '../billing/my-invoices.component';
import { AdminRevenueComponent } from './admin-revenue.component';
import { AdminSitesComponent } from './admin-sites.component';

@Component({
  selector: 'app-admin-shell',
  imports: [
    RouterLink,
    NgIcon,
    HlmAvatarImports,
    HlmButton,
    HlmDropdownMenuImports,
    HlmSidebarImports,
    HlmToaster,
    AdminDashboardComponent,
    AdminCustomersComponent,
    AdminResellersComponent,
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
      lucideCreditCard,
      lucideFileText,
      lucideGlobe,
      lucideHouse,
      lucideMoon,
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
  readonly theme = inject(ThemeService);
  readonly section = signal<AdminSection>(adminSection(this.location.pathname));
  readonly nav: {
    section: AdminSection;
    href: string;
    label: string;
    icon: string;
  }[] = [
    { section: 'inicio', href: '/', label: 'Início', icon: 'lucideHouse' },
    { section: 'clientes', href: '/clientes', label: 'Clientes', icon: 'lucideUsers' },
    { section: 'revendedores', href: '/revendedores', label: 'Revendedores', icon: 'lucideStore' },
    { section: 'sites', href: '/sites', label: 'Sites', icon: 'lucideGlobe' },
    { section: 'planos', href: '/planos', label: 'Planos', icon: 'lucideCreditCard' },
    {
      section: 'configuracoes',
      href: '/configuracoes',
      label: 'Configurações',
      icon: 'lucideSettings',
    },
    { section: 'cupons', href: '/cupons', label: 'Cupons', icon: 'lucideTicket' },
    { section: 'receita', href: '/receita', label: 'Receita', icon: 'lucideWallet' },
    { section: 'faturas', href: '/faturas', label: 'Minhas faturas', icon: 'lucideFileText' },
  ];

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.section.set(adminSection(this.location.pathname));
    });
  }

  title(): string {
    return this.nav.find((item) => item.section === this.section())?.label ?? 'Início';
  }
}
