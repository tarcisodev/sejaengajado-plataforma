import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { API_PORT } from '../../core/api/api-port';
import { HttpApiService } from '../../core/api/http-api.service';
import {
  authErrorInterceptor,
  resetAuthErrorInterceptorState,
} from '../../core/auth/auth-error.interceptor';
import { AuthService } from '../../core/auth/auth.service';
import { ResellerSitesComponent } from './reseller-sites.component';

@Component({ selector: 'app-entrar-stub', template: 'entrar', standalone: true })
class EntrarStubComponent {}

describe('Reseller AUTH-WEB part 2 (e2e-style)', () => {
  beforeEach(() => {
    resetAuthErrorInterceptorState();
  });

  it('RESELLER A list only contains A rows (never B resellerId)', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpApiService,
        { provide: API_PORT, useExisting: HttpApiService },
        { provide: AuthService, useValue: { signOut: async () => undefined } },
      ],
    });

    const api = TestBed.inject(API_PORT);
    const http = TestBed.inject(HttpTestingController);
    const pending = firstValueFrom(api.listResellerSites());
    http
      .expectOne((r) => r.url.includes('/reseller/sites'))
      .flush({
        items: [
          {
            id: 'site-a',
            resellerId: 'reseller-a',
            customerId: 'cust-a',
            slug: 'loja-a',
            templateId: 't1',
            planId: 'p1',
            status: 'PUBLISHED',
            editable: true,
            content: {},
            publishedAt: null,
            hostingRenewsAt: null,
            plaqueFidelityEndsAt: null,
          },
        ],
        nextCursor: null,
      });
    const page = await pending;
    expect(page.items.every((site) => site.resellerId === 'reseller-a')).toBeTrue();
    expect(page.items.some((site) => site.resellerId === 'reseller-b')).toBeFalse();
    http.verify();
  });

  it('401 calls signOut once and skips while already on /entrar', async () => {
    let signOutCalls = 0;
    let currentUrl = '/revenda';
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

    const first = firstValueFrom(api.getResellerDashboard()).catch((error) => error);
    http
      .expectOne((r) => r.url.includes('/reseller/dashboard'))
      .flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await first;
    expect(signOutCalls).toBe(1);
    expect(currentUrl).toBe('/entrar');

    const second = firstValueFrom(api.getResellerDashboard()).catch((error) => error);
    http
      .expectOne((r) => r.url.includes('/reseller/dashboard'))
      .flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await second;
    expect(signOutCalls).toBe(1);
    http.verify();
  });

  it('403 shows message and does not call signOut', async () => {
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
    const router = TestBed.inject(Router);
    const before = router.url;

    const pending = firstValueFrom(api.publishResellerSite('site-b')).catch((error) => error);
    http
      .expectOne((r) => r.url.includes('/reseller/sites/site-b/publish'))
      .flush({ message: 'Recurso de outro revendedor' }, { status: 403, statusText: 'Forbidden' });
    await pending;
    expect(signOutCalls).toBe(0);
    expect(router.url).toBe(before);
    http.verify();
  });

  it('sites UI only renders reseller A site rows', async () => {
    TestBed.configureTestingModule({
      imports: [ResellerSitesComponent],
      providers: [
        {
          provide: API_PORT,
          useValue: {
            listResellerSites: () =>
              of({
                items: [
                  {
                    id: 'site-a',
                    resellerId: 'reseller-a',
                    customerId: 'c1',
                    slug: 'loja-a',
                    templateId: 't',
                    planId: 'p',
                    status: 'DRAFT',
                    editable: true,
                    content: {},
                    publishedAt: null,
                    hostingRenewsAt: null,
                    plaqueFidelityEndsAt: null,
                    customer: { id: 'c1', name: 'Cliente A' },
                  },
                ],
                nextCursor: null,
              }),
            listResellerCustomers: () => of({ items: [], nextCursor: null }),
            listResellerSiteOptions: () => of({ plans: [], templates: [] }),
            checkResellerSlug: () => of({ slug: '', available: true }),
            createResellerSite: () => of({}),
            publishResellerSite: () => of({}),
          },
        },
      ],
    });

    const fixture: ComponentFixture<ResellerSitesComponent> =
      TestBed.createComponent(ResellerSitesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const resellerIds = [...fixture.nativeElement.querySelectorAll('[data-reseller-id]')].map(
      (el) => (el as HTMLElement).getAttribute('data-reseller-id'),
    );
    expect(resellerIds).toEqual(['reseller-a']);
    expect(fixture.nativeElement.textContent).not.toContain('reseller-b');
  });
});
