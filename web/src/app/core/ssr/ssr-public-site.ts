import { InjectionToken } from '@angular/core';

/** Public by-host JSON already fetched by Express — avoid a second SSR HttpClient GET. */
export const SSR_PUBLIC_SITE = new InjectionToken<Record<string, unknown> | null>(
  'SSR_PUBLIC_SITE',
);
