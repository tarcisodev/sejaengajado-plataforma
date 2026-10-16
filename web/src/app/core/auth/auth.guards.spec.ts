import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { aal2Guard, authGuard, homeRedirectGuard, roleGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards (UX-BOOT)', () => {
  function setup(opts: {
    sessionStatus: 'loading' | 'authenticated' | 'anonymous';
    me?: { role: 'ADMIN' | 'RESELLER' | 'CUSTOMER' } | null;
    aal?: 'aal1' | 'aal2' | null;
    server?: boolean;
  }) {
    const auth = {
      sessionStatus: () => opts.sessionStatus,
      me: () => opts.me ?? null,
      ensureReady: async () => undefined,
      getAuthenticatorAssuranceLevel: async () => opts.aal ?? null,
      homePathForRole: (role: string) =>
        role === 'ADMIN' ? '/admin' : role === 'RESELLER' ? '/revenda' : '/conta',
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: PLATFORM_ID, useValue: opts.server ? 'server' : 'browser' },
      ],
    });
    return { router: TestBed.inject(Router) };
  }

  it('authGuard waits and allows authenticated', async () => {
    setup({ sessionStatus: 'authenticated', me: { role: 'RESELLER' } });
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('authGuard sends anonymous to /entrar', async () => {
    const { router } = setup({ sessionStatus: 'anonymous', me: null });
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toEqual(router.createUrlTree(['/entrar']));
  });

  it('authGuard on SSR redirects to /entrar (no private prerender)', async () => {
    const { router } = setup({ sessionStatus: 'loading', server: true });
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toEqual(router.createUrlTree(['/entrar']));
  });

  it('roleGuard rejects wrong role after ready', async () => {
    const { router } = setup({ sessionStatus: 'authenticated', me: { role: 'CUSTOMER' } });
    const guard = roleGuard('ADMIN');
    const result = await TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(result).toEqual(router.createUrlTree(['/entrar']));
  });

  it('homeRedirectGuard sends ADMIN to /admin', async () => {
    const { router } = setup({ sessionStatus: 'authenticated', me: { role: 'ADMIN' } });
    const result = await TestBed.runInInjectionContext(() =>
      homeRedirectGuard({} as never, {} as never),
    );
    expect(result).toEqual(router.createUrlTree(['/admin']));
  });

  it('aal2Guard sends aal1 to /mfa', async () => {
    const { router } = setup({
      sessionStatus: 'authenticated',
      me: { role: 'ADMIN' },
      aal: 'aal1',
    });
    const result = await TestBed.runInInjectionContext(() =>
      aal2Guard({} as never, {} as never),
    );
    expect(result).toEqual(router.createUrlTree(['/mfa']));
  });
});
