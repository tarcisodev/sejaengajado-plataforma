import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import type { UserRole } from '../models/domain';
import { AuthService } from './auth.service';

/**
 * SSR: redireciona para /entrar (shell público) — evita prerender de painel e mismatch.
 * Cliente: espera sessionStatus sair de loading via ensureReady.
 */
export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return router.createUrlTree(['/entrar']);
  }
  const auth = inject(AuthService);
  await auth.ensureReady();
  if (auth.sessionStatus() !== 'authenticated' || !auth.me()) {
    return router.createUrlTree(['/entrar']);
  }
  return true;
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);
    if (isPlatformServer(platformId)) {
      return router.createUrlTree(['/entrar']);
    }
    const auth = inject(AuthService);
    await auth.ensureReady();
    const me = auth.me();
    if (auth.sessionStatus() !== 'authenticated' || !me || !roles.includes(me.role)) {
      return router.createUrlTree(['/entrar']);
    }
    return true;
  };
}

/** ADMIN: exige aal2 (TOTP via mfa.getAuthenticatorAssuranceLevel). Caso contrário → /mfa. */
export const aal2Guard: CanActivateFn = async () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return router.createUrlTree(['/entrar']);
  }
  const auth = inject(AuthService);
  await auth.ensureReady();
  if (auth.sessionStatus() !== 'authenticated' || !auth.me()) {
    return router.createUrlTree(['/entrar']);
  }
  const level = await auth.getAuthenticatorAssuranceLevel();
  if (level !== 'aal2') {
    return router.createUrlTree(['/mfa']);
  }
  return true;
};

/** `/` no host app.: manda para a home do papel ou /entrar. */
export const homeRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return router.createUrlTree(['/entrar']);
  }
  const auth = inject(AuthService);
  await auth.ensureReady();
  const me = auth.me();
  if (auth.sessionStatus() !== 'authenticated' || !me) {
    return router.createUrlTree(['/entrar']);
  }
  return router.createUrlTree([auth.homePathForRole(me.role)]);
};
