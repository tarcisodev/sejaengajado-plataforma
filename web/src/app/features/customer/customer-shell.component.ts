import { PlatformLocation } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { appArea } from './app-area';
import { CustomerLoginComponent } from './customer-login.component';
import { CustomerSession } from './customer-session';
import { CustomerStudioComponent } from './customer-studio.component';

@Component({
  selector: 'app-customer-shell',
  imports: [RouterLink, CustomerLoginComponent, CustomerStudioComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './customer-shell.component.html',
})
export class CustomerShellComponent {
  private readonly location = inject(PlatformLocation);
  private readonly router = inject(Router);
  readonly session = inject(CustomerSession);
  readonly entering = signal(
    appArea(this.location.pathname || '/') === 'customer' && this.head() === 'entrar',
  );

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.sync();
    });
    this.sync();
  }

  leave(): void {
    this.session.clear();
    void this.router.navigateByUrl('/entrar');
  }

  private sync(): void {
    const login = this.head() === 'entrar';
    this.entering.set(login);
    if (!login && !this.session.user()) {
      void this.router.navigateByUrl('/entrar');
    }
  }

  private head(): string {
    return (this.location.pathname || '/').split('/').filter(Boolean)[0] ?? '';
  }
}
