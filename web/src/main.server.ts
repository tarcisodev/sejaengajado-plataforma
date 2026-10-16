import { provideZoneChangeDetection } from '@angular/core';
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { apiInternalUrlForSsr } from './app/core/ssr/fetch-public-site';
import { environment } from './environments/environment';

// Tenant Host has no Traefik `/api` route — relative `/api` would loop on web-ssr
// (timeout). Point SSR HttpClient at Nest on the overlay network.
environment.apiUrl = apiInternalUrlForSsr();

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(
    AppComponent,
    { ...config, providers: [provideZoneChangeDetection(), ...config.providers] },
    context,
  );

export default bootstrap;
