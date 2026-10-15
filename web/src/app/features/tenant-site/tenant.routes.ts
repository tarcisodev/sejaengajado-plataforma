import { Routes } from '@angular/router';

import { API_PORT } from '../../core/api/api-port';
import { TenantResolver } from '../../core/tenant/tenant-resolver';
import { MockApiService } from '../../mocks/mock-api.service';
import { TenantGateComponent } from './tenant-gate.component';

export const tenantRoutes: Routes = [
  {
    path: '',
    providers: [TenantResolver, MockApiService, { provide: API_PORT, useExisting: MockApiService }],
    children: [
      { path: '', component: TenantGateComponent },
      { path: '**', component: TenantGateComponent },
    ],
  },
];
