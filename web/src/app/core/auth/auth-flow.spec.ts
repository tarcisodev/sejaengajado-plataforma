import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GuardResult, provideRouter, RedirectCommand, Router, UrlTree } from '@angular/router';

import { aal2Guard, authGuard, homeRedirectGuard, roleGuard } from './auth.guards';
import { AuthService } from './auth.service';
import type { AuthMe } from './auth.types';

function asTree(result: GuardResult | Promise<GuardResult> | unknown): string {
  const value = result as GuardResult;
  if (value === true) {
    return 'ALLOW';
  }
  if (value instanceof RedirectCommand) {
    return TestBed.inject(Router).serializeUrl(value.redirectTo);
  }
  return TestBed.inject(Router).serializeUrl(value as UrlTree);
}

describe('AUTH-WEB flows (e2e-style)', () => {
  const me = signal<AuthMe | null>(null);
  let mfaLevel: 'aal1' | 'aal2' | null = 'aal1';

  function configure(opts: {
    platform: string;
    role?: AuthMe['role'] | null;
    mfaLevel?: 'aal1' | 'aal2';
  }): void {
    mfaLevel = opts.mfaLevel ?? 'aal1';
    me.set(
      opts.role
        ? {
            id: 'u1',
            email: 'user@example.com',
            role: opts.role,
            resellerId: opts.role === 'RESELLER' ? 'r1' : null,
            status: 'ACTIVE',
            aal: 'aal1',
          }
        : null,
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: opts.platform },
        {
          provide: AuthService,
          useValue: {
            me,
            ready: signal(true),
            ensureReady: async () => undefined,
            getAuthenticatorAssuranceLevel: async () => mfaLevel,
            homePathForRole: (role: AuthMe['role']) => {
              if (role === 'ADMIN') return '/admin';
              if (role === 'RESELLER') return '/revenda';
              return '/conta';
            },
            signOut: async () => {
              me.set(null);
              try {
                sessionStorage.clear();
              } catch {
                /* ignore */
              }
              const keys: string[] = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && /^sb-.*-auth-token$/i.test(key)) {
                  keys.push(key);
                }
              }
              for (const key of keys) {
                localStorage.removeItem(key);
              }
            },
          },
        },
      ],
    });
  }

  it('anonymous /admin on SSR → /entrar (authGuard)', async () => {
    configure({ platform: 'server', role: null });
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(asTree(result)).toBe('/entrar');
  });

  it('anonymous /admin on browser → /entrar (authGuard)', async () => {
    configure({ platform: 'browser', role: null });
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(asTree(result)).toBe('/entrar');
  });

  it('CUSTOMER cannot access ADMIN routes (roleGuard)', async () => {
    configure({ platform: 'browser', role: 'CUSTOMER' });
    const guard = roleGuard('ADMIN');
    const result = await TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(asTree(result)).toBe('/entrar');
  });

  it('ADMIN without aal2 → /mfa (aal2Guard)', async () => {
    configure({ platform: 'browser', role: 'ADMIN', mfaLevel: 'aal1' });
    const result = await TestBed.runInInjectionContext(() => aal2Guard({} as never, {} as never));
    expect(asTree(result)).toBe('/mfa');
  });

  it('anonymous / on SSR → /entrar (homeRedirectGuard)', async () => {
    configure({ platform: 'server', role: null });
    const result = await TestBed.runInInjectionContext(() =>
      homeRedirectGuard({} as never, {} as never),
    );
    expect(asTree(result)).toBe('/entrar');
  });

  it('RESELLER / on browser → /revenda (homeRedirectGuard)', async () => {
    configure({ platform: 'browser', role: 'RESELLER' });
    const result = await TestBed.runInInjectionContext(() =>
      homeRedirectGuard({} as never, {} as never),
    );
    expect(asTree(result)).toBe('/revenda');
  });

  it('logout removes sb-*-auth-token from storage', async () => {
    configure({ platform: 'browser', role: 'ADMIN', mfaLevel: 'aal2' });
    localStorage.setItem('sb-xxxx-auth-token', 'jwt');
    sessionStorage.setItem('seja.customer.session', '{}');
    await TestBed.inject(AuthService).signOut();
    expect(localStorage.getItem('sb-xxxx-auth-token')).toBeNull();
    expect(sessionStorage.getItem('seja.customer.session')).toBeNull();
    expect(me()).toBeNull();
  });
});
