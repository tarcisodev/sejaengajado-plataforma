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

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { CheckoutComponent } from '../billing/checkout.component';
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
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly checkout = signal(false);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.sync();
    });
    this.sync();
  }

  initial(): string {
    return (this.auth.me()?.email ?? '?').slice(0, 1).toUpperCase();
  }

  leave(): void {
    void this.auth.signOut();
  }

  private sync(): void {
    const parts = (this.location.pathname || '/').split('/').filter(Boolean);
    this.checkout.set(parts[0] === 'conta' && parts[1] === 'checkout');
  }
}
