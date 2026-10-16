import { InjectionToken, REQUEST_CONTEXT, inject } from '@angular/core';

import type { SsrRequestContext } from './ssr-request-context';

/** Public by-host JSON already fetched by Express — avoid a second SSR HttpClient GET. */
export const SSR_PUBLIC_SITE = new InjectionToken<Record<string, unknown> | null>(
  'SSR_PUBLIC_SITE',
);

/**
 * Factory: reads REQUEST_CONTEXT every request (Angular SSR reuses top-level
 * useValue across requests — that caused false 404 after the first render).
 */
export function ssrPublicSiteFactory(): Record<string, unknown> | null {
  const ctx = inject(REQUEST_CONTEXT, { optional: true }) as SsrRequestContext | null | undefined;
  return ctx?.publicSite ?? null;
}
