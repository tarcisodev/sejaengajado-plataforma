import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/tenant-site/tenant-gate.component').then((m) => m.TenantGateComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/tenant-site/tenant-gate.component').then((m) => m.TenantGateComponent),
  },
];
