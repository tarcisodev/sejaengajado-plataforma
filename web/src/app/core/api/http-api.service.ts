import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

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
  ShippingQuoteResult,
  Site,
  SiteContent,
  SiteStatus,
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
import { archivedPublicSite, siteFromPublicBody } from './public-site.mapper';
import { endOfDaySaoPauloIso } from './coupon-date';
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
  CreateResellerResult,
  CreateSiteCommand,
  CustomerOtp,
  CustomerUploadPresign,
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
  private readonly auth = inject(AuthService);
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
    // Admin-only. Do not fall back to /customer/templates — that looped 401/404
    // on every public tenant SSR via SitePageComponent.
    return this.http
      .get<{
        items?: { id: string; key: string; name: string; niche: string; schemaType?: string }[];
      }>(this.url('/admin/templates'))
      .pipe(
        map((body) =>
          (body.items ?? []).map((row): Template => ({
            id: row.id,
            key: row.key,
            nome: row.name,
            ramo: row.niche,
            schemaType: (row.schemaType as Template['schemaType']) ?? 'LocalBusiness',
            schema: {},
            ativo: true,
          })),
        ),
      );
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

  createReseller(command: CreateResellerCommand): Observable<CreateResellerResult> {
    return this.http
      .post<Record<string, unknown>>(this.url('/admin/resellers'), {
        name: command.nome.trim(),
        email: command.userId.trim(),
        resellerPlanId: command.resellerPlanId,
      })
      .pipe(
        map((body) => ({
          ...mapReseller(body),
          inviteActionLink: (body['inviteActionLink'] as string | null | undefined) ?? null,
        })),
      );
  }

  listCustomers(_resellerId?: string | null): Observable<Customer[]> {
    return this.http
      .get<CursorPage<AdminCustomerDto>>(this.url('/admin/customers'), {
        params: new HttpParams().set('limit', '100'),
      })
      .pipe(map((body) => (body.items ?? []).map(customerFromAdminDto)));
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
    return this.http
      .get<CursorPage<ResellerSiteDto>>(this.url('/admin/sites'), {
        params: new HttpParams().set('limit', '100'),
      })
      .pipe(map((body) => (body.items ?? []).map(siteFromResellerDto)));
  }

  createSite(command: CreateSiteCommand): Observable<Site> {
    return this.http
      .post<ResellerSiteDto>(this.url('/admin/sites'), {
        customerId: command.customerId,
        slug: command.slug,
        templateId: command.templateId,
        planId: command.planId,
        content: {
          businessName: command.businessName,
          phone: command.phone,
          profile: {
            nome: command.businessName,
            cidade: command.address.cidade,
            uf: command.address.uf,
          },
          address: {
            logradouro: command.address.logradouro,
            cidade: command.address.cidade,
            uf: command.address.uf,
            cep: command.address.cep,
          },
          theme: { niche: 'generico' },
        },
      })
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  listPayments(_resellerId?: string | null): Observable<Payment[]> {
    return this.http
      .get<CursorPage<AdminPaymentDto>>(this.url('/admin/payments'), {
        params: new HttpParams().set('limit', '100'),
      })
      .pipe(map((body) => (body.items ?? []).map(paymentFromAdminDto)));
  }

  getSiteBySlug(slug: string): Observable<Site | null> {
    const host = `${slug.trim().toLowerCase()}.sejaengajado.com.br`;
    return this.http
      .get<Record<string, unknown>>(this.url('/public/sites/by-host'), {
        params: new HttpParams().set('host', host),
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      })
      .pipe(
        map((body) => siteFromPublicBody(body, slug)),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 410) {
            return of(archivedPublicSite(slug));
          }
          return of(null);
        }),
      );
  }

  quotePlaquePenalty(siteId: string, _today: Date): Observable<PlaquePenaltyQuote> {
    return this.http.get<PlaquePenaltyQuote>(this.url(`/customer/sites/${siteId}/plaque-penalty`));
  }

  cancelSite(siteId: string, _today: Date): Observable<Cancellation> {
    return this.http.post<Cancellation>(this.url(`/customer/sites/${siteId}/cancel`), {});
  }

  getOrder(_orderId: string): Observable<Order | null> {
    return of(null);
  }

  closeResellerInvoice(
    resellerId: string,
    mes: string,
    closedAt: string,
  ): Observable<ResellerInvoice> {
    return this.http.post<ResellerInvoice>(
      this.url(`/admin/resellers/${resellerId}/invoices/close`),
      { period: mes, closedAt },
    );
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

  setSiteStatus(
    siteId: string,
    status: 'PUBLISHED' | 'SUSPENDED' | 'DRAFT' | 'ARCHIVED',
  ): Observable<Site> {
    return this.http
      .patch<ResellerSiteDto>(this.url(`/admin/sites/${siteId}/status`), { status })
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  getAdminSite(siteId: string): Observable<Site> {
    return this.http
      .get<ResellerSiteDto>(this.url(`/admin/sites/${siteId}`))
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  updateAdminSiteContent(
    siteId: string,
    content: SiteContent,
    templateId?: string,
  ): Observable<Site> {
    const body: Record<string, unknown> = { content };
    if (templateId) {
      body['templateId'] = templateId;
    }
    return this.http
      .patch<ResellerSiteDto>(this.url(`/admin/sites/${siteId}/content`), body)
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  patchAdminSiteMeta(
    siteId: string,
    body: {
      slug?: string;
      planId?: string;
      status?: SiteStatus;
      customerId?: string;
      resellerId?: string;
    },
  ): Observable<Site> {
    return this.http
      .patch<ResellerSiteDto>(this.url(`/admin/sites/${siteId}`), body)
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  publishAdminSite(siteId: string): Observable<Site> {
    return this.http
      .post<ResellerSiteDto>(this.url(`/admin/sites/${siteId}/publish`), {})
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  unpublishAdminSite(siteId: string): Observable<Site> {
    return this.http
      .post<ResellerSiteDto>(this.url(`/admin/sites/${siteId}/unpublish`), {})
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  archiveAdminSite(siteId: string): Observable<Site> {
    return this.http
      .post<ResellerSiteDto>(this.url(`/admin/sites/${siteId}/archive`), {})
      .pipe(map((row) => siteFromResellerDto(row)));
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
        validTo: coupon.validade ? endOfDaySaoPauloIso(coupon.validade) : undefined,
        maxUses: coupon.maxUsos || undefined,
      })
      .pipe(map(mapCoupon));
  }

  deleteCoupon(couponId: string): Observable<void> {
    return this.http.delete<void>(this.url(`/admin/coupons/${couponId}`));
  }

  requestCustomerOtp(email: string): Observable<CustomerOtp> {
    return new Observable((subscriber) => {
      void this.auth
        .requestPasswordReset(email)
        .then(() => {
          subscriber.next({ delivered: true, previewCode: null });
          subscriber.complete();
        })
        .catch((error: unknown) => subscriber.error(error));
    });
  }

  verifyCustomerOtp(email: string, password: string): Observable<User> {
    return new Observable((subscriber) => {
      void this.auth
        .signInWithPassword(email, password)
        .then((me) => {
          subscriber.next({
            id: me.id,
            supabaseId: me.id,
            email: me.email,
            role: me.role,
          });
          subscriber.complete();
        })
        .catch((error: unknown) => subscriber.error(error));
    });
  }

  listMySites(): Observable<Site[]> {
    return this.http
      .get<ResellerSiteDto[] | { items?: ResellerSiteDto[] }>(this.url('/customer/sites'))
      .pipe(map((body) => asSiteRows(body).map(siteFromResellerDto)));
  }

  listSitesByCustomer(_customerId: string): Observable<Site[]> {
    return this.listMySites();
  }

  listCustomerTemplates(): Observable<Template[]> {
    return this.http
      .get<
        | { id: string; key: string; name: string; niche: string }[]
        | { items?: { id: string; key: string; name: string; niche: string }[] }
      >(this.url('/customer/templates'))
      .pipe(
        map((body) => {
          const rows = Array.isArray(body) ? body : (body.items ?? []);
          return rows.map((row): Template => ({
            id: row.id,
            key: row.key,
            nome: row.name,
            ramo: row.niche,
            schemaType: 'LocalBusiness',
            schema: {},
            ativo: true,
          }));
        }),
      );
  }

  updateSiteContent(siteId: string, content: SiteContent, templateId: string): Observable<Site> {
    return this.http
      .patch<ResellerSiteDto>(this.url(`/customer/sites/${siteId}`), {
        templateId,
        content,
      })
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  publishSite(siteId: string): Observable<Site> {
    return this.http
      .post<ResellerSiteDto>(this.url(`/customer/sites/${siteId}/publish`), {})
      .pipe(map((row) => siteFromResellerDto(row)));
  }

  presignCustomerUpload(body: {
    contentType: string;
    contentLength: number;
    filename?: string;
  }): Observable<CustomerUploadPresign> {
    return this.http.post<CustomerUploadPresign>(this.url('/customer/uploads/presign'), body);
  }

  requestSiteChange(siteId: string, _actorId: string, note: string): Observable<AuditLog> {
    return this.http
      .post<AuditLog>(this.url(`/customer/sites/${siteId}/request-change`), { note })
      .pipe(
        map((row) => ({
          actor: String((row as { actor?: string }).actor ?? 'customer'),
          acao: String((row as { acao?: string }).acao ?? 'customer.request_site_change'),
          entidade: String((row as { entidade?: string }).entidade ?? `Site:${siteId}`),
          diff: ((row as { diff?: Record<string, unknown> }).diff ?? {}) as Record<string, unknown>,
        })),
      );
  }

  requestMonthlyPlan(siteId: string, _actorId: string): Observable<AuditLog> {
    return this.http
      .post<AuditLog>(this.url(`/customer/sites/${siteId}/request-monthly-plan`), {})
      .pipe(
        map((row) => ({
          actor: String((row as { actor?: string }).actor ?? 'customer'),
          acao: String((row as { acao?: string }).acao ?? 'customer.request_monthly_plan'),
          entidade: String((row as { entidade?: string }).entidade ?? `Site:${siteId}`),
          diff: ((row as { diff?: Record<string, unknown> }).diff ?? {}) as Record<string, unknown>,
        })),
      );
  }

  listAuditLogs(): Observable<AuditLog[]> {
    return this.http
      .get<CursorPage<Record<string, unknown>>>(this.url('/admin/audit-logs'))
      .pipe(map((body) => (body.items ?? []).map(mapAuditLog)));
  }

  quoteShipping(destinationCep: string, quantity?: number): Observable<ShippingQuoteResult> {
    return this.http.post<ShippingQuoteResult>(this.url('/billing/shipping/quote'), {
      destinationCep,
      quantity,
    });
  }

  checkoutPronto(
    command: {
      siteId: string;
      customerName: string;
      customerEmail: string;
      couponCode?: string;
      method: PaymentMethod;
      destinationCep?: string;
      shippingServiceId?: string;
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
    return this.http.get<MyResellerInvoice[]>(this.url('/reseller/invoices')).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)) {
          return this.http
            .get<MyResellerInvoice[] | { items?: MyResellerInvoice[] }>(this.url('/admin/invoices'))
            .pipe(map((body) => (Array.isArray(body) ? body : (body.items ?? []))));
        }
        return throwError(() => error);
      }),
    );
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
    email?: string;
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

  deleteResellerSite(siteId: string): Observable<ResellerSiteDto | { ok: true }> {
    return this.http.delete<ResellerSiteDto | { ok: true }>(this.url(`/reseller/sites/${siteId}`));
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
          reason: 'GIFT' | 'ASSIGN';
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

  patchReseller(
    id: string,
    body: {
      name?: string;
      resellerPlanId?: string;
      document?: string;
      phone?: string;
      addressLine?: string;
      addressCity?: string;
      addressUf?: string;
      addressCep?: string;
      notes?: string;
    },
  ): Observable<Reseller> {
    return this.http
      .patch<Record<string, unknown>>(this.url(`/admin/resellers/${id}`), body)
      .pipe(map(mapReseller));
  }

  sendResellerPasswordReset(id: string): Observable<{ inviteActionLink: string | null }> {
    return this.http.post<{ inviteActionLink: string | null }>(
      this.url(`/admin/resellers/${id}/password-reset`),
      {},
    );
  }

  resetResellerMfa(id: string): Observable<{ removed: number }> {
    return this.http.post<{ removed: number }>(this.url(`/admin/resellers/${id}/mfa-reset`), {});
  }

  getMyResellerProfile(): Observable<Reseller> {
    return this.http.get<Record<string, unknown>>(this.url('/reseller/me')).pipe(map(mapReseller));
  }

  patchMyResellerProfile(body: {
    name?: string;
    document?: string;
    phone?: string;
    addressLine?: string;
    addressCity?: string;
    addressUf?: string;
    addressCep?: string;
  }): Observable<Reseller> {
    return this.http
      .patch<Record<string, unknown>>(this.url('/reseller/me'), body)
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

interface AdminCustomerDto {
  id: string;
  userId?: string | null;
  resellerId: string | null;
  name: string;
  doc: string;
  whatsapp: string;
  city: string;
}

interface AdminPaymentDto {
  id: string;
  orderId: string | null;
  resellerId: string | null;
  method: PaymentMethod;
  status: Payment['status'];
  amountCents: number;
  gatewayPaymentId?: string | null;
  paidAt?: string | null;
}

function customerFromAdminDto(row: AdminCustomerDto): Customer {
  return {
    id: row.id,
    userId: row.userId ?? null,
    resellerId: row.resellerId,
    nome: row.name,
    doc: row.doc,
    whatsapp: row.whatsapp,
    cidade: row.city,
  };
}

function paymentFromAdminDto(row: AdminPaymentDto): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    subscriptionId: null,
    resellerId: row.resellerId,
    gateway: 'asaas',
    gatewayPaymentId: row.gatewayPaymentId ?? '',
    metodo: row.method,
    valor: row.amountCents,
    status: row.status,
    paidAt: row.paidAt ?? null,
  };
}

function asItems(
  body: { items?: Record<string, unknown>[] } | Record<string, unknown>[],
): Record<string, unknown>[] {
  return Array.isArray(body) ? body : (body.items ?? []);
}

function asSiteRows(body: ResellerSiteDto[] | { items?: ResellerSiteDto[] }): ResellerSiteDto[] {
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
