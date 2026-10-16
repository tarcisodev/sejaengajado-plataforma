import { Routes } from '@angular/router';

import { ResellerShellComponent } from './reseller-shell.component';

export const resellerRoutes: Routes = [
  {
    path: '',
    component: ResellerShellComponent,
    children: [
      { path: '', pathMatch: 'full', children: [] },
      { path: '**', children: [] },
    ],
  },
];
