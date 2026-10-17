import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router, type UrlTree } from '@angular/router';

import type { UserRole } from '../models/domain';
import { AuthService } from './auth.service';

/** Safe internal path for post-login resume (blocks open redirects). */
function safeReturnUrl(url: string | undefined): string | undefined {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return undefined;
  }
  if (url.startsWith('/entrar') || url.startsWith('/mfa')) {
    return undefined;
  }
  return url;
}

function toEntrar(router: Router, attemptedUrl?: string): UrlTree {
  const returnUrl = safeReturnUrl(attemptedUrl);
  return returnUrl
    ? router.createUrlTree(['/entrar'], { queryParams: { returnUrl } })
    : router.createUrlTree(['/entrar']);
}

/**
 * SSR: redireciona para /entrar (shell público) — evita prerender de painel e mismatch.
 * Cliente: espera sessionStatus sair de loading via ensureReady.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return toEntrar(router, state.url);
  }
  const auth = inject(AuthService);
  await auth.ensureReady();
  if (auth.sessionStatus() !== 'authenticated' || !auth.me()) {
    return toEntrar(router, state.url);
  }
  return true;
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return async (_route, state) => {
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);
    if (isPlatformServer(platformId)) {
      return toEntrar(router, state.url);
    }
    const auth = inject(AuthService);
    await auth.ensureReady();
    const me = auth.me();
    if (auth.sessionStatus() !== 'authenticated' || !me || !roles.includes(me.role)) {
      return toEntrar(router, state.url);
    }
    return true;
  };
}

/**
 * MFA opcional: só redireciona a /mfa se o usuário já tiver TOTP enrolado
 * e ainda precisar do desafio (nextLevel aal2). Sem fator, e-mail+senha basta.
 */
export const aal2Guard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return toEntrar(router, state.url);
  }
  const auth = inject(AuthService);
  await auth.ensureReady();
  if (auth.sessionStatus() !== 'authenticated' || !auth.me()) {
    return toEntrar(router, state.url);
  }
  if (await auth.needsMfaChallenge()) {
    const returnUrl = safeReturnUrl(state.url);
    return returnUrl
      ? router.createUrlTree(['/mfa'], { queryParams: { returnUrl } })
      : router.createUrlTree(['/mfa']);
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
