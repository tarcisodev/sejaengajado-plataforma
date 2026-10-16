import { Routes } from '@angular/router';

import { AdminShellComponent } from './admin-shell.component';

/** Shell único; seções ainda resolvidas por pathname sob `/admin/*`. */
export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', pathMatch: 'full', children: [] },
      { path: '**', children: [] },
    ],
  },
];
