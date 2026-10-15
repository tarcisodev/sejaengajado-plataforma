import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withNoIncrementalHydration,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { provideSpartanHlm } from '@spartan-ng/helm/utils';

import { API_PORT } from './core/api/api-port';
import { routes } from './app.routes';
import { MockApiService } from './mocks/mock-api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay(), withNoIncrementalHydration()),
    provideSpartanHlm(),
    { provide: API_PORT, useExisting: MockApiService },
  ],
};
