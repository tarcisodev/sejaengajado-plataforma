import { Routes } from '@angular/router';

import { TenantResolver } from '../../core/tenant/tenant-resolver';
import { legalRoutes } from '../legal/legal.routes';
import { TenantGateComponent } from './tenant-gate.component';

/** Apex + slug — painéis autenticados ficam no host `app.` (ver `app.routes.ts`). */
export const tenantRoutes: Routes = [
  {
    path: '',
    providers: [TenantResolver],
    children: [
      ...legalRoutes,
      { path: '', component: TenantGateComponent },
      { path: '**', component: TenantGateComponent },
    ],
  },
];
