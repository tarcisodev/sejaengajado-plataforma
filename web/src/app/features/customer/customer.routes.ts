import { Routes } from '@angular/router';

import { CustomerShellComponent } from './customer-shell.component';

export const customerRoutes: Routes = [
  {
    path: '',
    component: CustomerShellComponent,
    children: [
      { path: '', pathMatch: 'full', children: [] },
      { path: 'checkout', children: [] },
      { path: '**', children: [] },
    ],
  },
];
