import { PlatformLocation } from '@angular/common';
import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';

/** `app.` / `app.localhost` — painéis autenticados. */
export function isAppHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, '');
  return host === 'app' || host.startsWith('app.');
}

export const appHostCanMatch: CanMatchFn = () => {
  const location = inject(PlatformLocation);
  return isAppHost(location.hostname);
};

/** Apex + `<slug>.` — TenantGate (landing / site). */
export const tenantHostCanMatch: CanMatchFn = () => {
  const location = inject(PlatformLocation);
  return !isAppHost(location.hostname);
};
