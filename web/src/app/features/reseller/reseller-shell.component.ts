import { PlatformLocation } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideFileText,
  lucideGlobe,
  lucideHouse,
  lucideMoon,
  lucidePackage,
  lucideReceipt,
  lucideShoppingCart,
  lucideSun,
  lucideUsers,
} from '@ng-icons/lucide';
import { HlmAlert } from '@spartan-ng/helm/alert';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { filter } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { BrandMarkComponent } from '../../core/brand/brand-mark.component';
import { ThemeService } from '../../core/theme/theme.service';
import { MyInvoicesComponent } from '../billing/my-invoices.component';
import { ResellerCustomersComponent } from './reseller-customers.component';
import { ResellerDashboardComponent } from './reseller-dashboard.component';
import { ResellerLedgerComponent } from './reseller-ledger.component';
import { ResellerSalesComponent } from './reseller-sales.component';
import { ResellerSection, resellerSection } from './reseller-section';
import { ResellerSitesComponent } from './reseller-sites.component';
import { ResellerStockComponent } from './reseller-stock.component';

@Component({
  selector: 'app-reseller-shell',
  imports: [
    RouterLink,
    NgIcon,
    BrandMarkComponent,
    HlmAlert,
    HlmButton,
    HlmToaster,
    ResellerDashboardComponent,
    ResellerCustomersComponent,
    ResellerSitesComponent,
    ResellerSalesComponent,
    ResellerStockComponent,
    ResellerLedgerComponent,
    MyInvoicesComponent,
  ],
  providers: [
    provideIcons({
      lucideFileText,
      lucideGlobe,
      lucideHouse,
      lucideMoon,
      lucidePackage,
      lucideReceipt,
      lucideShoppingCart,
      lucideSun,
      lucideUsers,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reseller-shell.component.html',
})
export class ResellerShellComponent {
  private readonly location = inject(PlatformLocation);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly section = signal<ResellerSection>(resellerSection(this.location.pathname));
  readonly resellerLocked = computed(() => {
    const status = this.auth.me()?.resellerStatus;
    return status === 'DELINQUENT' || status === 'BLOCKED';
  });
  readonly lockMessage = computed(() => {
    const status = this.auth.me()?.resellerStatus;
    if (status === 'BLOCKED') {
      return 'Revendedor bloqueado: criação de sites e publicações estão suspensas.';
    }
    if (status === 'DELINQUENT') {
      return 'Revendedor inadimplente: novos sites e publicações ficam bloqueados até a regularização.';
    }
    return '';
  });
  readonly nav: {
    section: ResellerSection;
    href: string;
    label: string;
    icon: string;
  }[] = [
    { section: 'inicio', href: '/revenda', label: 'Início', icon: 'lucideHouse' },
    { section: 'clientes', href: '/revenda/clientes', label: 'Clientes', icon: 'lucideUsers' },
    { section: 'sites', href: '/revenda/sites', label: 'Sites', icon: 'lucideGlobe' },
    { section: 'vendas', href: '/revenda/vendas', label: 'Vendas', icon: 'lucideShoppingCart' },
    { section: 'estoque', href: '/revenda/estoque', label: 'Estoque', icon: 'lucidePackage' },
    { section: 'extrato', href: '/revenda/extrato', label: 'Extrato', icon: 'lucideReceipt' },
    { section: 'faturas', href: '/revenda/faturas', label: 'Faturas', icon: 'lucideFileText' },
  ];

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.section.set(resellerSection(this.location.pathname));
    });
  }

  title(): string {
    return this.nav.find((item) => item.section === this.section())?.label ?? 'Início';
  }

  leave(): void {
    void this.auth.signOut();
  }
}
