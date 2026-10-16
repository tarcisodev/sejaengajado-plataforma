import { Routes } from '@angular/router';

import { AuthCallbackComponent } from './auth-callback.component';
import { LoginComponent } from './login.component';
import { MfaComponent } from './mfa.component';

export const authFeatureRoutes: Routes = [
  {
    path: 'entrar',
    component: LoginComponent,
  },
  {
    path: 'auth/callback',
    component: AuthCallbackComponent,
  },
  {
    path: 'mfa',
    component: MfaComponent,
  },
];
