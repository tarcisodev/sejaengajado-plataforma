import { provideServerRendering } from '@angular/ssr';
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';

import { appConfig } from './app.config';
import { SSR_PUBLIC_SITE, ssrPublicSiteFactory } from './core/ssr/ssr-public-site';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    // Per-request via factory + REQUEST_CONTEXT (never useValue — sticky across requests).
    { provide: SSR_PUBLIC_SITE, useFactory: ssrPublicSiteFactory },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
