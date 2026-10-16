import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { HttpApiService } from '../api/http-api.service';
import { API_PORT } from '../api/api-port';
import { authErrorInterceptor, resetAuthErrorInterceptorState } from './auth-error.interceptor';
import { AuthService } from './auth.service';
import { resetSupabaseBrowserTestHooks, setSupabaseBrowserTestHooks } from './supabase-browser';

@Component({ selector: 'app-entrar-stub', template: 'entrar', standalone: true })
class EntrarStubComponent {}

describe('authErrorInterceptor', () => {
  beforeEach(() => {
    resetAuthErrorInterceptorState();
    resetSupabaseBrowserTestHooks();
  });

  afterEach(() => {
    resetSupabaseBrowserTestHooks();
  });

  it('on 401 without session refresh, signs out once toward /entrar', async () => {
    setSupabaseBrowserTestHooks({ ensure: async () => null });
    let signOutCalls = 0;
    let currentUrl = '/admin';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'entrar', component: EntrarStubComponent }]),
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
        HttpApiService,
        { provide: API_PORT, useExisting: HttpApiService },
        {
          provide: Router,
          useValue: {
            get url() {
              return currentUrl;
            },
            navigateByUrl: async (url: string) => {
              currentUrl = url;
              return true;
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            signOut: async () => {
              signOutCalls += 1;
              currentUrl = '/entrar';
            },
          },
        },
      ],
    });

    const api = TestBed.inject(API_PORT);
    const http = TestBed.inject(HttpTestingController);
    const pending = firstValueFrom(api.getResellerDashboard()).catch((e) => e);
    http
      .expectOne((r) => r.url.includes('/reseller/dashboard'))
      .flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await pending;
    expect(signOutCalls).toBe(1);
    expect(currentUrl).toBe('/entrar');
    http.verify();
  });

  it('shares one refreshSession across concurrent 401s', async () => {
    let refreshCalls = 0;
    setSupabaseBrowserTestHooks({
      ensure: async () =>
        ({
          auth: {
            refreshSession: async () => {
              refreshCalls += 1;
              await new Promise((r) => setTimeout(r, 20));
              return { data: { session: null }, error: { message: 'nope' } };
            },
          },
        }) as never,
    });

    let signOutCalls = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'entrar', component: EntrarStubComponent }]),
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
        HttpApiService,
        { provide: API_PORT, useExisting: HttpApiService },
        {
          provide: AuthService,
          useValue: {
            signOut: async () => {
              signOutCalls += 1;
            },
          },
        },
      ],
    });

    const api = TestBed.inject(API_PORT);
    const http = TestBed.inject(HttpTestingController);
    const a = firstValueFrom(api.getResellerDashboard()).catch((e) => e);
    const b = firstValueFrom(api.listResellerSales()).catch((e) => e);
    http
      .expectOne((r) => r.url.includes('/reseller/dashboard'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne((r) => r.url.includes('/reseller/sales'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await Promise.all([a, b]);
    expect(refreshCalls).toBe(1);
    expect(signOutCalls).toBe(1);
    http.verify();
  });

  it('toasts 404 without signing out', async () => {
    let signOutCalls = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'entrar', component: EntrarStubComponent }]),
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
        HttpApiService,
        { provide: API_PORT, useExisting: HttpApiService },
        {
          provide: AuthService,
          useValue: {
            signOut: async () => {
              signOutCalls += 1;
            },
          },
        },
      ],
    });

    const api = TestBed.inject(API_PORT);
    const http = TestBed.inject(HttpTestingController);
    const pending = firstValueFrom(api.publishResellerSite('alien')).catch((e) => e);
    http
      .expectOne((r) => r.url.includes('/reseller/sites/alien/publish'))
      .flush({ message: 'Site não encontrado' }, { status: 404, statusText: 'Not Found' });
    await pending;
    expect(signOutCalls).toBe(0);
    http.verify();
  });
});
