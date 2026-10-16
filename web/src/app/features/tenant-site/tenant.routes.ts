import { Routes } from '@angular/router';

import { TenantResolver } from '../../core/tenant/tenant-resolver';
import { TenantGateComponent } from './tenant-gate.component';

/** Apex + slug — painéis autenticados ficam no host `app.` (ver `app.routes.ts`). */
export const tenantRoutes: Routes = [
  {
    path: '',
    providers: [TenantResolver],
    children: [
      { path: '', component: TenantGateComponent },
      { path: '**', component: TenantGateComponent },
    ],
  },
];

