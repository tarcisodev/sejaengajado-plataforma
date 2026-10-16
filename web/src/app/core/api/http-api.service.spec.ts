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
