import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideAppInitializer,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { apiProviders } from './core/api/api.providers';
import { AuthService } from './core/auth/auth.service';
import { authErrorInterceptor } from './core/auth/auth-error.interceptor';
import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { provideSentry } from './core/sentry/provide-sentry';
import { provideSpartanHlm } from './shared/ui/utils/src/lib/provide-spartan-hlm';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor, authErrorInterceptor])),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideSpartanHlm(),
    provideSentry(),
    ...apiProviders,
    provideAppInitializer(() => inject(AuthService).ensureReady()),
  ],
};
