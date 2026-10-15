import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { authTokenInterceptor } from './core/auth/auth-token.interceptor';
import { provideSentry } from './core/sentry/provide-sentry';
import { provideSpartanHlm } from './shared/ui/utils/src/lib/provide-spartan-hlm';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor])),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideSpartanHlm(),
    provideSentry(),
  ],
};
