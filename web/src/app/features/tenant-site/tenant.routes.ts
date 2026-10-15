import { Routes } from '@angular/router';

import { apiProviders } from '../../core/api/api.providers';
import { TenantResolver } from '../../core/tenant/tenant-resolver';
import { TenantGateComponent } from './tenant-gate.component';

export const tenantRoutes: Routes = [
  {
    path: '',
    providers: [TenantResolver, ...apiProviders],
    children: [
      { path: '', component: TenantGateComponent },
      { path: '**', component: TenantGateComponent },
    ],
  },
];
