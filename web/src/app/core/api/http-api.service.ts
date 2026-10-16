import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AuditLog,
  Cancellation,
  CheckoutResult,
  Coupon,
  Customer,
  MyResellerInvoice,
  NoticeLog,
  Order,
  Payment,
  PaymentMethod,
  PaymentStatusView,
  Plan,
  PlatformConfig,
  Reseller,
  ResellerInvoice,
  ResellerPlan,
  Site,
  SiteContent,
  Template,
  User,
} from '../models/domain';
import {
  mapAuditLog,
  mapCoupon,
  mapPlan,
  mapPlatformConfig,
  mapReseller,
  mapResellerPlan,
  toApiPlatformConfig,
  unsupported,
} from './api-mappers';
import type {
  AdminPlaqueMoveCommand,
  AdminProductDto,
  ImpersonateResultDto,
  PlaqueMovementDto as AdminPlaqueMovementDto,
  PlaqueStockRowDto,
  ResellerSummaryDto,
  ResellerWholesaleAdminDto,
  SetWholesaleCommand,
  TransferPlaquesCommand,
  WholesalePriceRowDto,
} from './admin-api.types';
import {
  ApiPort,
  BlockResellerCommand,
  CreateCustomerCommand,
  CreateResellerCommand,
  CreateSiteCommand,
  CustomerOtp,
  NoticeRecord,
} from './api-port';
import { PlaquePenaltyQuote } from './plaque-penalty';
import type {
  CursorPage,
  LedgerStatementDto,
  PlaqueMovementDto,
  PlaqueStockItemDto,
  ResellerCustomerDto,
  ResellerDashboardDto,
  ResellerPriceItemDto,
  ResellerSaleDto,
  ResellerSiteDto,
  SiteOptionsDto,
  SlugCheckDto,
  WholesaleItemDto,
} from './reseller-api.types';

@Injectable()
export class HttpApiService implements ApiPort {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  getPlatformConfig(): Observable<PlatformConfig> {
    return this.http
      .get<Record<string, unknown>>(this.url('/admin/config'))
      .pipe(map(mapPlatformConfig));
  }

  updatePlatformConfig(patch: Partial<PlatformConfig>): Observable<PlatformConfig> {
    return this.http
      .put<Record<string, unknown>>(this.url('/admin/config'), toApiPlatformConfig(patch))
      .pipe(map(mapPlatformConfig));
  }

  listPlans(): Observable<Plan[]> {
    return this.http
      .get<{ items: Record<string, unknown>[] } | Record<string, unknown>[]>(
        this.url('/admin/plans'),
      )
      .pipe(map((body) => asItems(body).map(mapPlan)));
  }

  listTemplates(): Observable<Template[]> {
    return of([]);
  }

  listCoupons(): Observable<Coupon[]> {
    return this.http
      .get<{ items: Record<string, unknown>[] }>(this.url('/admin/coupons'))
      .pipe(map((body) => (body.items ?? []).map(mapCoupon)));
  }

  listResellers(): Observable<Reseller[]> {
    return this.http
      .get<CursorPage<Record<string, unknown>>>(this.url('/admin/resellers'))
      .pipe(map((body) => (body.items ?? []).map(mapReseller)));
  }

  listResellerPlans(): Observable<ResellerPlan[]> {
    return this.http
      .get<Record<string, unknown>[] | { items: Record<string, unknown>[] }>(
        this.url('/admin/reseller-plans'),
      )
      .pipe(map((body) => asItems(body).map(mapResellerPlan)));
  }

  createReseller(command: CreateResellerCommand): Observable<Reseller> {
    return this.http
      .post<Record<string, unknown>>(this.url('/admin/resellers'), {
        name: command.nome.trim(),
        email: command.userId.trim(),
        resellerPlanId: command.resellerPlanId,
      })
      .pipe(map(mapReseller));
  }

  listCustomers(_resellerId?: string | null): Observable<Customer[]> {
    return of([]);
  }

  createCustomer(command: CreateCustomerCommand): Observable<Customer> {
    return this.createResellerCustomer({
      name: command.nome,
      doc: command.doc,
      whatsapp: command.whatsapp,
      city: command.cidade,
    }).pipe(
      map((row): Customer => ({
        id: row.id,
        userId: null,
        resellerId: row.resellerId,
        nome: row.name,
        doc: row.doc,
        whatsapp: row.whatsapp,
        cidade: row.city,
      })),
    );
  }

  listSites(_resellerId?: string | null): Observable<Site[]> {
    return of([]);
  }

  createSite(command: CreateSiteCommand): Observable<Site> {
    return this.createResellerSite({
      customerId: command.customerId,
      slug: command.slug,
      templateId: command.templateId,
      planId: command.planId,
    }).pipe(map((row) => siteFromResellerDto(row)));
  }

  listPayments(_resellerId?: string | null): Observable<Payment[]> {
    return of([]);
  }

  getSiteBySlug(slug: string): Observable<Site | null> {
    const host = `${slug.trim().toLowerCase()}.sejaengajado.com.br`;
    return this.http
      .get<Record<string, unknown>>(this.url('/public/sites/by-host'), {
        params: new HttpParams().set('host', host),
      })
      .pipe(
        map((body) => publicSiteToDomain(body, slug)),
        catchError(() => of(null)),
      );
  }

  quotePlaquePenalty(_siteId: string, _today: Date): Observable<PlaquePenaltyQuote> {
    return throwError(() => unsupported('quotePlaquePenalty'));
  }

  cancelSite(_siteId: string, _today: Date): Observable<Cancellation> {
    return throwError(() => unsupported('cancelSite'));
  }

  getOrder(_orderId: string): Observable<Order | null> {
    return of(null);
  }

  closeResellerInvoice(
    _resellerId: string,
    _mes: string,
    _closedAt: string,
  ): Observable<ResellerInvoice> {
    return throwError(() => unsupported('closeResellerInvoice'));
  }

  recordNotice(_notice: NoticeLog): Observable<NoticeRecord> {
    return throwError(() => unsupported('recordNotice'));
  }

  canCreateSite(_resellerId: string): Observable<boolean> {
    return of(true);
  }

  blockReseller(resellerId: string, command: BlockResellerCommand): Observable<Reseller> {
    return this.http
      .post<Record<string, unknown>>(this.url(`/admin/resellers/${resellerId}/block`), {
        reason: command.reason,
      })
      .pipe(map(mapReseller));
  }

  unblockReseller(
    resellerId: string,
    _actorId: string,
    _unblockedAt: string,
  ): Observable<Reseller> {
    return this.http
      .post<Record<string, unknown>>(this.url(`/admin/resellers/${resellerId}/unblock`), {})
      .pipe(map(mapReseller));
  }

  offerMigration(resellerId: string, _actorId: string, _today: Date): Observable<AuditLog> {
    return this.http
      .post<Record<string, unknown>>(this.url(`/admin/resellers/${resellerId}/offer-migration`), {})
      .pipe(
        map((): AuditLog => ({
          actor: 'admin',
          acao: 'reseller.offer-migration',
          entidade: `Reseller:${resellerId}`,
          diff: {},
        })),
      );
  }

  setSiteStatus(_siteId: string, _status: 'PUBLISHED' | 'SUSPENDED'): Observable<Site> {
    return throwError(() => unsupported('setSiteStatus'));
  }

  savePlan(plan: Plan): Observable<Plan> {
    if (plan.id) {
      return this.http
        .patch<Record<string, unknown>>(this.url(`/admin/plans/${plan.id}`), {
          name: plan.nome,
          type: plan.tipo,
          priceCents: plan.precoCentavos,
          interval: plan.intervalo,
          features: plan.features,
        })
        .pipe(map(mapPlan));
    }
    return this.http
      .post<Record<string, unknown>>(this.url('/admin/plans'), {
        code: plan.code,
        name: plan.nome,
        type: plan.tipo,
        priceCents: plan.precoCentavos,
        interval: plan.intervalo,
        features: plan.features,
      })
      .pipe(map(mapPlan));
  }

  saveCoupon(coupon: Coupon): Observable<Coupon> {
    return this.http
      .post<Record<string, unknown>>(this.url('/admin/coupons'), {
        code: coupon.code,
        type: coupon.tipo,
        value: coupon.valor,
        active: true,
        validTo: coupon.validade || undefined,
        maxUses: coupon.maxUsos || undefined,
      })
      .pipe(map(mapCoupon));
  }

  deleteCoupon(_couponId: string): Observable<void> {
    return throwError(() => unsupported('deleteCoupon'));
  }

  requestCustomerOtp(_email: string): Observable<CustomerOtp> {
    return throwError(() => unsupported('requestCustomerOtp'));
  }

  verifyCustomerOtp(_email: string, _code: string): Observable<User> {
    return throwError(() => unsupported('verifyCustomerOtp'));
  }

  listSitesByCustomer(_customerId: string): Observable<Site[]> {
    return this.listResellerSites().pipe(
      map((page) =>
        page.items
          .filter((site) => site.customerId === _customerId)
          .map((site) => siteFromResellerDto(site)),
      ),
    );
  }

  updateSiteContent(siteId: string, content: SiteContent, templateId: string): Observable<Site> {
    return this.http
      .patch<ResellerSiteDto>(this.url(`/reseller/sites/${siteId}`), {
        templateId,
        content,
      })
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  publishSite(siteId: string): Observable<Site> {
    return this.publishResellerSite(siteId).pipe(map((row) => siteFromResellerDto(row)));
  }

  requestSiteChange(_siteId: string, _actorId: string, _note: string): Observable<AuditLog> {
    return throwError(() => unsupported('requestSiteChange'));
  }

  requestMonthlyPlan(_siteId: string, _actorId: string): Observable<AuditLog> {
    return throwError(() => unsupported('requestMonthlyPlan'));
  }

  listAuditLogs(): Observable<AuditLog[]> {
    return this.http
      .get<CursorPage<Record<string, unknown>>>(this.url('/admin/audit-logs'))
      .pipe(map((body) => (body.items ?? []).map(mapAuditLog)));
  }

  checkoutPronto(
    command: {
      siteId: string;
      customerName: string;
      customerEmail: string;
      couponCode?: string;
      method: PaymentMethod;
    },
    idempotencyKey: string,
  ): Observable<CheckoutResult> {
    return this.http.post<CheckoutResult>(this.url('/billing/checkout/pronto'), command, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  getPaymentStatus(gatewayPaymentId: string): Observable<PaymentStatusView> {
    return this.http.get<PaymentStatusView>(
      this.url(`/billing/payments/${encodeURIComponent(gatewayPaymentId)}`),
    );
  }

  listMyInvoices(): Observable<MyResellerInvoice[]> {
    return this.http.get<MyResellerInvoice[]>(this.url('/reseller/invoices'));
  }

  getMyInvoice(id: string): Observable<MyResellerInvoice> {
    return this.http.get<MyResellerInvoice>(this.url(`/reseller/invoices/${id}`));
  }

  getResellerDashboard(): Observable<ResellerDashboardDto> {
    return this.http.get<ResellerDashboardDto>(this.url('/reseller/dashboard'));
  }

  listResellerCustomers(cursor?: string | null): Observable<CursorPage<ResellerCustomerDto>> {
    return this.http.get<CursorPage<ResellerCustomerDto>>(this.url('/reseller/customers'), {
      params: cursorParams(cursor),
    });
  }

  createResellerCustomer(body: {
    name: string;
    doc?: string;
    whatsapp?: string;
    city?: string;
  }): Observable<ResellerCustomerDto> {
    return this.http.post<ResellerCustomerDto>(this.url('/reseller/customers'), body);
  }

  listResellerSites(cursor?: string | null): Observable<CursorPage<ResellerSiteDto>> {
    return this.http.get<CursorPage<ResellerSiteDto>>(this.url('/reseller/sites'), {
      params: cursorParams(cursor),
    });
  }

  createResellerSite(body: {
    customerId: string;
    slug: string;
    templateId: string;
    planId: string;
    content?: Record<string, unknown>;
  }): Observable<ResellerSiteDto> {
    return this.http.post<ResellerSiteDto>(this.url('/reseller/sites'), body);
  }

  patchResellerSite(
    siteId: string,
    body: {
      templateId?: string;
      planId?: string;
      slug?: string;
      content?: Record<string, unknown>;
    },
  ): Observable<ResellerSiteDto> {
    return this.http.patch<ResellerSiteDto>(this.url(`/reseller/sites/${siteId}`), body);
  }

  publishResellerSite(siteId: string): Observable<ResellerSiteDto> {
    return this.http.post<ResellerSiteDto>(this.url(`/reseller/sites/${siteId}/publish`), {});
  }

  unpublishResellerSite(siteId: string): Observable<ResellerSiteDto> {
    return this.http.post<ResellerSiteDto>(this.url(`/reseller/sites/${siteId}/unpublish`), {});
  }

  checkResellerSlug(slug: string): Observable<SlugCheckDto> {
    return this.http.get<SlugCheckDto>(this.url('/reseller/slugs/check'), {
      params: new HttpParams().set('slug', slug),
    });
  }

  listResellerSiteOptions(): Observable<SiteOptionsDto> {
    return this.http.get<SiteOptionsDto>(this.url('/reseller/site-options'));
  }

  listResellerSales(cursor?: string | null): Observable<CursorPage<ResellerSaleDto>> {
    return this.http.get<CursorPage<ResellerSaleDto>>(this.url('/reseller/sales'), {
      params: cursorParams(cursor),
    });
  }

  recordResellerSale(
    items: { productId: string; qty: number; unitPriceCents: number }[],
    idempotencyKey: string,
  ): Observable<ResellerSaleDto> {
    return this.http.post<ResellerSaleDto>(
      this.url('/reseller/sales'),
      { items },
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      },
    );
  }

  getResellerLedger(opts?: {
    from?: string;
    to?: string;
    cursor?: string | null;
  }): Observable<LedgerStatementDto> {
    let params = new HttpParams();
    if (opts?.from) params = params.set('from', opts.from);
    if (opts?.to) params = params.set('to', opts.to);
    if (opts?.cursor) params = params.set('cursor', opts.cursor);
    return this.http.get<LedgerStatementDto>(this.url('/reseller/ledger'), { params });
  }

  getResellerLedgerBalance(): Observable<{ balanceCents: number }> {
    return this.http.get<{ balanceCents: number }>(this.url('/reseller/ledger/balance'));
  }

  listResellerWholesale(): Observable<{ items: WholesaleItemDto[] }> {
    return this.http.get<{ items: WholesaleItemDto[] }>(this.url('/reseller/wholesale'));
  }

  listResellerPrices(): Observable<{ items: ResellerPriceItemDto[] }> {
    return this.http.get<{ items: ResellerPriceItemDto[] }>(this.url('/reseller/prices'));
  }

  listResellerPlaqueStock(): Observable<{ items: PlaqueStockItemDto[] }> {
    return this.http.get<{ items: PlaqueStockItemDto[] }>(this.url('/reseller/plaques/stock'));
  }

  listResellerPlaqueMovements(cursor?: string | null): Observable<CursorPage<PlaqueMovementDto>> {
    return this.http.get<CursorPage<PlaqueMovementDto>>(this.url('/reseller/plaques/movements'), {
      params: cursorParams(cursor),
    });
  }

  recordResellerPlaqueMovement(
    body:
      | {
          type: 'IN';
          plaqueType: 'QR' | 'NFC';
          qty: number;
          unitCostCents?: number;
          reason?: string;
        }
      | {
          type: 'OUT';
          plaqueType: 'QR' | 'NFC';
          qty: number;
          reason: 'GIFT';
          siteId: string;
        },
    idempotencyKey: string,
  ): Observable<PlaqueMovementDto> {
    return this.http.post<PlaqueMovementDto>(this.url('/reseller/plaques/movements'), body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  getReseller(id: string): Observable<Reseller> {
    return this.http
      .get<Record<string, unknown>>(this.url(`/admin/resellers/${id}`))
      .pipe(map(mapReseller));
  }

  getResellerSummary(id: string): Observable<ResellerSummaryDto> {
    return this.http.get<ResellerSummaryDto>(this.url(`/admin/resellers/${id}/summary`));
  }

  suspendResellerSites(id: string): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(this.url(`/admin/resellers/${id}/suspend-sites`), {});
  }

  impersonateReseller(id: string): Observable<ImpersonateResultDto> {
    return this.http.post<ImpersonateResultDto>(this.url(`/admin/resellers/${id}/impersonate`), {});
  }

  listAdminProducts(): Observable<AdminProductDto[]> {
    return this.http
      .get<AdminProductDto[] | { items: AdminProductDto[] }>(this.url('/admin/products'))
      .pipe(map((body) => (Array.isArray(body) ? body : (body.items ?? []))));
  }

  listResellerWholesaleAdmin(resellerId: string): Observable<ResellerWholesaleAdminDto> {
    return this.http.get<ResellerWholesaleAdminDto>(
      this.url(`/admin/resellers/${resellerId}/wholesale`),
    );
  }

  setResellerWholesale(
    resellerId: string,
    body: SetWholesaleCommand,
  ): Observable<WholesalePriceRowDto> {
    return this.http
      .post<{
        id: string;
        productId: string;
        priceCents: number;
        validFrom: string | Date;
        validTo: string | Date | null;
      }>(this.url(`/admin/resellers/${resellerId}/wholesale`), body)
      .pipe(
        map((row) => ({
          id: row.id,
          productId: row.productId,
          code: '',
          name: '',
          priceCents: row.priceCents,
          validFrom:
            typeof row.validFrom === 'string'
              ? row.validFrom
              : new Date(row.validFrom).toISOString(),
          validTo: row.validTo
            ? typeof row.validTo === 'string'
              ? row.validTo
              : new Date(row.validTo).toISOString()
            : null,
        })),
      );
  }

  getAdminPlaqueStock(resellerId: string): Observable<PlaqueStockRowDto[]> {
    return this.http
      .get<{ items: PlaqueStockRowDto[] }>(this.url('/admin/plaques/stock'), {
        params: new HttpParams().set('resellerId', resellerId),
      })
      .pipe(map((body) => body.items ?? []));
  }

  listAdminPlaqueMovements(
    resellerId: string,
    cursor?: string | null,
  ): Observable<CursorPage<AdminPlaqueMovementDto>> {
    let params = new HttpParams().set('resellerId', resellerId);
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    return this.http.get<CursorPage<AdminPlaqueMovementDto>>(this.url('/admin/plaques/movements'), {
      params,
    });
  }

  postAdminPlaqueMovement(
    body: AdminPlaqueMoveCommand,
    idempotencyKey: string,
  ): Observable<AdminPlaqueMovementDto> {
    return this.http.post<AdminPlaqueMovementDto>(this.url('/admin/plaques/movements'), body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  transferPlaques(body: TransferPlaquesCommand, idempotencyKey: string): Observable<unknown> {
    return this.http.post(this.url('/admin/plaques/transfer'), body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  private url(path: string): string {
    return `${this.base}${path}`;
  }
}

function cursorParams(cursor?: string | null): HttpParams {
  if (!cursor) {
    return new HttpParams();
  }
  return new HttpParams().set('cursor', cursor);
}

function asItems(
  body: { items?: Record<string, unknown>[] } | Record<string, unknown>[],
): Record<string, unknown>[] {
  return Array.isArray(body) ? body : (body.items ?? []);
}

function siteFromResellerDto(row: ResellerSiteDto): Site {
  return {
    id: row.id,
    customerId: row.customerId,
    resellerId: row.resellerId,
    slug: row.slug,
    customDomain: null,
    templateId: row.templateId,
    content: (row.content as Site['content']) ?? emptySiteContent(row.slug),
    status: row.status as Site['status'],
    planId: row.planId,
    editable: row.editable,
    publishedAt: row.publishedAt,
    hostingRenewsAt: row.hostingRenewsAt,
    plaqueFidelityEndsAt: row.plaqueFidelityEndsAt,
  };
}

function publicSiteToDomain(body: Record<string, unknown>, slug: string): Site {
  return {
    id: String(body['id'] ?? slug),
    customerId: String(body['customerId'] ?? ''),
    resellerId: (body['resellerId'] as string | null) ?? null,
    slug: String(body['slug'] ?? slug),
    customDomain: (body['customDomain'] as string | null) ?? null,
    templateId: String(body['templateId'] ?? ''),
    content: (body['content'] as Site['content']) ?? emptySiteContent(slug),
    status: (body['status'] as Site['status']) ?? 'PUBLISHED',
    planId: String(body['planId'] ?? ''),
    editable: Boolean(body['editable'] ?? false),
    publishedAt: (body['publishedAt'] as string | null) ?? null,
    hostingRenewsAt: (body['hostingRenewsAt'] as string | null) ?? null,
    plaqueFidelityEndsAt: (body['plaqueFidelityEndsAt'] as string | null) ?? null,
  };
}

function emptySiteContent(slug: string): Site['content'] {
  return {
    businessName: slug,
    profile: { nome: slug, cidade: '', uf: '' },
    theme: {
      p1: '#1e3a5f',
      p2: '#3d5a4c',
      p3: '#d5e2dc',
      on3: '#102018',
      hi: '#f4f7f6',
      fontHeading: 'Fraunces, Palatino, serif',
      fontBody: 'Literata, Georgia, serif',
      fontScale: 1,
      italic: 'normal',
    },
  };
}
