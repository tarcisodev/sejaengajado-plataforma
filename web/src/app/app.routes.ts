import { Component, isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

import { aal2Guard, authGuard, homeRedirectGuard, roleGuard } from './core/auth/auth.guards';
import { appHostCanMatch, tenantHostCanMatch } from './core/auth/host-match';
import { AuthShellComponent } from './features/auth/auth-shell.component';
import { AuthCallbackComponent } from './features/auth/auth-callback.component';
import { LoginComponent } from './features/auth/login.component';
import { MfaComponent } from './features/auth/mfa.component';
import { legalRoutes } from './features/legal/legal.routes';

const devRoutes: Routes = isDevMode()
  ? [
      {
        path: 'dev/divisores',
        loadComponent: () =>
          import('./features/tenant-site/dev/divisores-demo.component').then(
            (m) => m.DivisoresDemoComponent,
          ),
      },
    ]
  : [];

/** Alvo inerte — o guard sempre redireciona. */
@Component({
  selector: 'app-route-redirect',
  template: '',
  standalone: true,
})
class RouteRedirectComponent {}

export const routes: Routes = [
  {
    path: '',
    canMatch: [appHostCanMatch],
    children: [
      ...legalRoutes,
      ...devRoutes,
      {
        path: '',
        component: AuthShellComponent,
        children: [
          // Precisa ser filho do shell: senão `/` casa o AuthShell vazio e nunca chega ao redirect.
          {
            path: '',
            pathMatch: 'full',
            canActivate: [homeRedirectGuard],
            component: RouteRedirectComponent,
          },
          { path: 'entrar', component: LoginComponent },
          { path: 'auth/callback', component: AuthCallbackComponent },
          { path: 'mfa', canActivate: [authGuard], component: MfaComponent },
        ],
      },
      {
        path: 'admin',
        canActivate: [authGuard, roleGuard('ADMIN'), aal2Guard],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
      },
      {
        path: 'revenda',
        canActivate: [authGuard, roleGuard('RESELLER')],
        loadChildren: () =>
          import('./features/reseller/reseller.routes').then((m) => m.resellerRoutes),
      },
      {
        path: 'conta',
        canActivate: [authGuard, roleGuard('CUSTOMER')],
        loadChildren: () =>
          import('./features/customer/customer.routes').then((m) => m.customerRoutes),
      },
      {
        path: '**',
        canActivate: [homeRedirectGuard],
        component: RouteRedirectComponent,
      },
    ],
  },
  {
    path: '',
    canMatch: [tenantHostCanMatch],
    loadChildren: () => import('./features/tenant-site/tenant.routes').then((m) => m.tenantRoutes),
  },
];
