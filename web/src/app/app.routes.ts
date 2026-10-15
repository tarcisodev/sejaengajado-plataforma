import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/tenant-site/tenant.routes').then((m) => m.tenantRoutes),
  },
];
