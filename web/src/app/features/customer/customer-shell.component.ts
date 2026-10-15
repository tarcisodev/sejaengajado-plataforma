import { PlatformLocation } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { filter } from 'rxjs';

import { ThemeService } from '../../core/theme/theme.service';
import { appArea } from './app-area';
import { CheckoutComponent } from '../billing/checkout.component';
import { CustomerLoginComponent } from './customer-login.component';
import { CustomerSession } from './customer-session';
import { CustomerStudioComponent } from './customer-studio.component';

@Component({
  selector: 'app-customer-shell',
  imports: [
    RouterLink,
    NgIcon,
    HlmAvatarImports,
    HlmButton,
    HlmDropdownMenuImports,
    HlmToaster,
    CustomerLoginComponent,
    CustomerStudioComponent,
    CheckoutComponent,
  ],
  providers: [provideIcons({ lucideMoon, lucideSun })],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './customer-shell.component.html',
})
export class CustomerShellComponent {
  private readonly location = inject(PlatformLocation);
  private readonly router = inject(Router);
  readonly session = inject(CustomerSession);
  readonly theme = inject(ThemeService);
  readonly entering = signal(
    appArea(this.location.pathname || '/') === 'customer' && this.head() === 'entrar',
  );
  readonly checkout = signal(false);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.sync();
    });
    this.sync();
  }

  initial(): string {
    return (this.session.user()?.email ?? '?').slice(0, 1).toUpperCase();
  }

  leave(): void {
    this.session.clear();
    void this.router.navigateByUrl('/entrar');
  }

  private sync(): void {
    const parts = (this.location.pathname || '/').split('/').filter(Boolean);
    const login = parts[0] === 'entrar';
    const onCheckout = parts[0] === 'conta' && parts[1] === 'checkout';
    this.entering.set(login);
    this.checkout.set(onCheckout);
    if (!login && !this.session.user()) {
      void this.router.navigateByUrl('/entrar');
    }
  }

  private head(): string {
    return (this.location.pathname || '/').split('/').filter(Boolean)[0] ?? '';
  }
}
