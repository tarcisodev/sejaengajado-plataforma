import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { authTokenInterceptor } from '../auth/auth-token.interceptor';
import {
  resetSupabaseBrowserTestHooks,
  setSupabaseBrowserTestHooks,
} from '../auth/supabase-browser';
import { API_PORT } from './api-port';
import { HttpApiService } from './http-api.service';

describe('HttpApiService (AUTH-WEB AW2)', () => {
  let http: HttpTestingController;
  let api: HttpApiService;

  beforeEach(() => {
    setSupabaseBrowserTestHooks({
      accessToken: async () => 'tok-test',
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        HttpApiService,
        { provide: API_PORT, useExisting: HttpApiService },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(HttpApiService);
  });

  afterEach(() => {
    http.verify();
    resetSupabaseBrowserTestHooks();
  });

  it('attaches Bearer from the Supabase session on /api calls', async () => {
    const pending = firstValueFrom(api.getResellerDashboard());
    await Promise.resolve();
    const req = http.expectOne((r) => r.url.includes('/reseller/dashboard'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-test');
    req.flush({
      activeSites: 0,
      monthSalesCents: 0,
      predictedMarginCents: 0,
      realizedMarginCents: 0,
      balanceCents: 0,
      stock: [],
      openInvoice: null,
      monthFrom: '2026-10-01',
      monthToExclusive: '2026-11-01',
    });
    await pending;
  });

  it('sends Idempotency-Key on money POSTs (sale + checkout)', async () => {
    const saleKey = 'sale-key-1';
    const salePending = firstValueFrom(
      api.recordResellerSale([{ productId: 'p1', qty: 1, unitPriceCents: 100 }], saleKey),
    );
    await Promise.resolve();
    const saleReq = http.expectOne((r) => r.url.includes('/reseller/sales') && r.method === 'POST');
    expect(saleReq.request.headers.get('Idempotency-Key')).toBe(saleKey);
    saleReq.flush({
      id: 's1',
      resellerId: 'r1',
      items: [],
      predictedMarginCents: 100,
      createdAt: new Date().toISOString(),
    });
    await salePending;

    const checkoutKey = 'checkout-key-1';
    const checkoutPending = firstValueFrom(
      api.checkoutPronto(
        {
          siteId: 'site1',
          customerName: 'Ana',
          customerEmail: 'ana@example.com',
          method: 'PIX',
        },
        checkoutKey,
      ),
    );
    await Promise.resolve();
    const checkoutReq = http.expectOne(
      (r) => r.url.includes('/billing/checkout/pronto') && r.method === 'POST',
    );
    expect(checkoutReq.request.headers.get('Idempotency-Key')).toBe(checkoutKey);
    checkoutReq.flush({
      orderId: 'o1',
      paymentId: 'pay1',
      gatewayPaymentId: 'g1',
      amountCents: 100,
      method: 'PIX',
      status: 'PENDING',
      pixQrCode: null,
      pixCopyPaste: null,
      invoiceUrl: null,
      bankSlipUrl: null,
    });
    await checkoutPending;
  });

  it('posts admin reseller create with name/email/plan (FF1)', async () => {
    const pending = firstValueFrom(
      api.createReseller({
        nome: 'Revenda Nova',
        userId: 'nova@example.com',
        resellerPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    await Promise.resolve();
    const req = http.expectOne((r) => r.url.includes('/admin/resellers') && r.method === 'POST');
    expect(req.request.body).toEqual({
      name: 'Revenda Nova',
      email: 'nova@example.com',
      resellerPlanId: '11111111-1111-4111-8111-111111111111',
    });
    req.flush({
      id: 'r-new',
      name: 'Revenda Nova',
      resellerPlanId: '11111111-1111-4111-8111-111111111111',
      status: 'ACTIVE',
      users: [{ id: 'u-new' }],
      inviteActionLink: 'https://auth.local/invite',
    });
    const created = await pending;
    expect(created.inviteActionLink).toBe('https://auth.local/invite');
    expect(created.nome).toBe('Revenda Nova');
  });

  it('maps by-host 410 to ARCHIVED and SUSPENDED flag (FF3)', async () => {
    const gone = firstValueFrom(api.getSiteBySlug('arquivo'));
    await Promise.resolve();
    http
      .expectOne(
        (r) =>
          r.url.includes('/public/sites/by-host') &&
          r.params.get('host') === 'arquivo.sejaengajado.com.br',
      )
      .flush({ code: 'GONE' }, { status: 410, statusText: 'Gone' });
    expect((await gone)?.status).toBe('ARCHIVED');

    const suspended = firstValueFrom(api.getSiteBySlug('pausa'));
    await Promise.resolve();
    http
      .expectOne((r) => r.url.includes('/public/sites/by-host'))
      .flush({
        slug: 'pausa',
        status: 'SUSPENDED',
        temporarilyUnavailable: true,
        content: {
          businessName: 'Pausa',
          profile: { nome: 'Pausa', cidade: '', uf: '' },
          theme: {},
        },
      });
    expect((await suspended)?.status).toBe('SUSPENDED');
  });

  it('uses /customer/sites for self-service list/patch/publish (AW7)', async () => {
    const listPending = firstValueFrom(api.listMySites());
    await Promise.resolve();
    const listReq = http.expectOne((r) => r.url.includes('/customer/sites') && r.method === 'GET');
    listReq.flush([
      {
        id: 'site1',
        resellerId: 'r1',
        customerId: 'c1',
        slug: 'loja',
        templateId: 't1',
        planId: 'p1',
        status: 'PUBLISHED',
        editable: true,
        content: {
          businessName: 'Loja',
          profile: { nome: 'Loja', cidade: 'Uberaba', uf: 'MG' },
          theme: {},
        },
        publishedAt: null,
        hostingRenewsAt: null,
        plaqueFidelityEndsAt: null,
      },
    ]);
    expect((await listPending)[0].slug).toBe('loja');

    const patchPending = firstValueFrom(
      api.updateSiteContent(
        'site1',
        {
          businessName: 'Loja Nova',
          profile: { nome: 'Loja Nova', cidade: 'Uberaba', uf: 'MG' },
          theme: {
            p1: '#000',
            p2: '#111',
            p3: '#fff',
            on3: '#000',
            hi: '#eee',
            fontHeading: 'serif',
            fontBody: 'sans',
            fontScale: 1,
            italic: 'normal',
          },
        },
        't1',
      ),
    );
    await Promise.resolve();
    const patchReq = http.expectOne(
      (r) => r.url.includes('/customer/sites/site1') && r.method === 'PATCH',
    );
    expect(patchReq.request.body.templateId).toBe('t1');
    patchReq.flush({
      id: 'site1',
      resellerId: 'r1',
      customerId: 'c1',
      slug: 'loja',
      templateId: 't1',
      planId: 'p1',
      status: 'PUBLISHED',
      editable: true,
      content: patchReq.request.body.content,
      publishedAt: null,
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: null,
    });
    expect((await patchPending).content.businessName).toBe('Loja Nova');

    const publishPending = firstValueFrom(api.publishSite('site1'));
    await Promise.resolve();
    http
      .expectOne((r) => r.url.includes('/customer/sites/site1/publish') && r.method === 'POST')
      .flush({
        id: 'site1',
        resellerId: 'r1',
        customerId: 'c1',
        slug: 'loja',
        templateId: 't1',
        planId: 'p1',
        status: 'PUBLISHED',
        editable: true,
        content: {
          businessName: 'Loja Nova',
          profile: { nome: 'Loja Nova', cidade: '', uf: '' },
          theme: {},
        },
        publishedAt: '2026-10-16',
        hostingRenewsAt: null,
        plaqueFidelityEndsAt: null,
      });
    expect((await publishPending).status).toBe('PUBLISHED');
  });

  it('sends Idempotency-Key on plaque movement POST', async () => {
    const key = 'plaque-in-1';
    const pending = firstValueFrom(
      api.recordResellerPlaqueMovement(
        { type: 'IN', plaqueType: 'QR', qty: 2, unitCostCents: 1300 },
        key,
      ),
    );
    await Promise.resolve();
    const req = http.expectOne(
      (r) => r.url.includes('/reseller/plaques/movements') && r.method === 'POST',
    );
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    req.flush({
      id: 'm1',
      resellerId: 'r1',
      type: 'IN',
      plaqueType: 'QR',
      qty: 2,
      unitCostCents: 1300,
      siteId: null,
      reason: 'compra',
      createdAt: new Date().toISOString(),
    });
    await pending;
  });
});
