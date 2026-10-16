import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';

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
} from '../core/api/admin-api.types';
import {
  ApiPort,
  BlockResellerCommand,
  CreateCustomerCommand,
  CreateResellerCommand,
  CreateResellerResult,
  CreateSiteCommand,
  CustomerUploadPresign,
  NoticeRecord,
} from '../core/api/api-port';
import {
  calculatePlaquePenalty,
  PlaquePenaltyQuote,
  toCivilDate,
} from '../core/api/plaque-penalty';
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
} from '../core/api/reseller-api.types';
import { migrationAvailable } from '../core/admin/migration';
import { canEditSite } from '../core/customer/access';
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
  SiteTheme,
  Template,
  User,
} from '../core/models/domain';
import { createUberabaSeed, MockDatabase, RESELLER_TRIANGULO } from './uberaba-seed';

const ACTIVE_SITE_STATUSES = new Set<Site['status']>(['PUBLISHED', 'READ_ONLY']);
const CUSTOMER_OTP = '482913';

@Injectable({ providedIn: 'root' })
export class MockApiService implements ApiPort {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly state: MockDatabase = createUberabaSeed();
  private otpEmail: string | null = null;
  private readonly checkoutByGateway = new Map<string, CheckoutResult>();
  private readonly wholesaleByReseller = new Map<string, WholesalePriceRowDto[]>();
  private readonly plaqueMoves: AdminPlaqueMovementDto[] = [];
  private readonly adminProducts: AdminProductDto[] = [
    {
      id: 'prod_site_pronto',
      code: 'SITE_ONE_TIME',
      name: 'Site Pronto',
      baseWholesaleCents: 4_900,
    },
    {
      id: 'prod_site_pro',
      code: 'SITE_PRO',
      name: 'Site Engajado Pro',
      baseWholesaleCents: 2_900,
    },
    { id: 'prod_plaque_qr', code: 'PLAQUE_QR', name: 'Placa QR', baseWholesaleCents: 1_500 },
    { id: 'prod_plaque_nfc', code: 'PLAQUE_NFC', name: 'Placa NFC', baseWholesaleCents: 2_500 },
  ];
  private readonly myInvoices: MyResellerInvoice[] = [
    {
      id: 'inv_mock_pending',
      period: '2026-09',
      status: 'OPEN',
      totalCents: 6_970,
      dueDate: '2026-10-20T00:00:00.000Z',
      gatewayPaymentId: 'pay_mock_pending',
      paymentStatus: 'PENDING',
      invoiceUrl: 'https://sandbox.asaas.com/i/mock_pending',
      bankSlipUrl: null,
      pixCopyPaste: '00020126MOCKPIXCOPIACOLA',
      lines: [
        {
          description: 'Mensalidade',
          qty: 1,
          unitCents: 4_990,
          totalCents: 4_990,
        },
        {
          description: 'Sites ativos (2)',
          qty: 2,
          unitCents: 990,
          totalCents: 1_980,
        },
      ],
    },
    {
      id: 'inv_mock_paid',
      period: '2026-08',
      status: 'PAID',
      totalCents: 4_990,
      dueDate: '2026-09-10T00:00:00.000Z',
      gatewayPaymentId: 'pay_mock_paid',
      paymentStatus: 'RECEIVED',
      invoiceUrl: null,
      bankSlipUrl: null,
      pixCopyPaste: null,
      lines: [
        {
          description: 'Mensalidade',
          qty: 1,
          unitCents: 4_990,
          totalCents: 4_990,
        },
      ],
    },
    {
      id: 'inv_mock_overdue',
      period: '2026-07',
      status: 'OVERDUE',
      totalCents: 5_980,
      dueDate: '2026-08-05T00:00:00.000Z',
      gatewayPaymentId: 'pay_mock_overdue',
      paymentStatus: 'OVERDUE',
      invoiceUrl: null,
      bankSlipUrl: 'https://sandbox.asaas.com/b/mock_overdue',
      pixCopyPaste: null,
      lines: [
        {
          description: 'Mensalidade + sites',
          qty: 1,
          unitCents: 5_980,
          totalCents: 5_980,
        },
      ],
    },
  ];

  getPlatformConfig(): Observable<PlatformConfig> {
    return of(structuredClone(this.state.platformConfig));
  }

  updatePlatformConfig(patch: Partial<PlatformConfig>): Observable<PlatformConfig> {
    this.state.platformConfig = { ...this.state.platformConfig, ...patch };
    return of(structuredClone(this.state.platformConfig));
  }

  listPlans(): Observable<Plan[]> {
    return of(structuredClone(this.state.plans));
  }

  listTemplates(): Observable<Template[]> {
    return of(structuredClone(this.state.templates));
  }

  listCoupons(): Observable<Coupon[]> {
    return of(structuredClone(this.state.coupons));
  }

  listResellers(): Observable<Reseller[]> {
    return of(structuredClone(this.state.resellers));
  }

  listResellerPlans(): Observable<ResellerPlan[]> {
    return of(structuredClone(this.state.resellerPlans));
  }

  createReseller(command: CreateResellerCommand): Observable<CreateResellerResult> {
    const reseller: CreateResellerResult = {
      id: `res_created_${this.state.resellers.length + 1}`,
      userId: command.userId.trim(),
      nome: command.nome.trim(),
      resellerPlanId: command.resellerPlanId,
      status: 'ACTIVE',
      delinquentSince: null,
      blockedAt: null,
      blockReason: null,
      asaasWalletId: null,
      inviteActionLink: `https://auth.example.local/invite?email=${encodeURIComponent(command.userId.trim())}`,
    };
    this.state.resellers.push(reseller);
    return of(structuredClone(reseller));
  }

  listCustomers(resellerId?: string | null): Observable<Customer[]> {
    return of(structuredClone(this.byReseller(this.state.customers, resellerId)));
  }

  createCustomer(command: CreateCustomerCommand): Observable<Customer> {
    const customer: Customer = {
      id: `cust_created_${this.state.customers.length + 1}`,
      userId: null,
      resellerId: command.resellerId,
      nome: command.nome.trim(),
      doc: command.doc.trim(),
      whatsapp: command.whatsapp.trim(),
      cidade: command.cidade.trim(),
    };
    this.state.customers.push(customer);
    return of(structuredClone(customer));
  }

  listSites(resellerId?: string | null): Observable<Site[]> {
    return of(structuredClone(this.byReseller(this.state.sites, resellerId)));
  }

  createSite(command: CreateSiteCommand): Observable<Site> {
    const customer = this.state.customers.find((item) => item.id === command.customerId);
    const plan = this.state.plans.find((item) => item.id === command.planId);
    const template = this.state.templates.find((item) => item.id === command.templateId);
    const slug = command.slug.trim().toLowerCase();
    if (!customer || !plan || !template) {
      return throwError(() => new Error('site references are missing'));
    }
    if (!/^[a-z0-9](?:-?[a-z0-9]){2,30}$/.test(slug)) {
      return throwError(() => new Error('invalid slug'));
    }
    if (
      this.state.reservedSlugs.some((item) => item.slug === slug) ||
      this.state.sites.some((item) => item.slug === slug)
    ) {
      return throwError(() => new Error('slug taken'));
    }
    const site: Site = {
      id: `site_created_${this.state.sites.length + 1}`,
      customerId: customer.id,
      resellerId: customer.resellerId,
      slug,
      customDomain: null,
      templateId: template.id,
      content: draftContent(command, slug),
      status: 'DRAFT',
      planId: plan.id,
      editable: plan.tipo === 'RECURRING',
      publishedAt: null,
      hostingRenewsAt: null,
      plaqueFidelityEndsAt: null,
    };
    this.state.sites.push(site);
    return of(structuredClone(site));
  }

  listPayments(resellerId?: string | null): Observable<Payment[]> {
    return of(structuredClone(this.byReseller(this.state.payments, resellerId)));
  }

  getSiteBySlug(slug: string): Observable<Site | null> {
    return of(structuredClone(this.state.sites.find((item) => item.slug === slug) ?? null));
  }

  quotePlaquePenalty(siteId: string, today: Date): Observable<PlaquePenaltyQuote> {
    const site = this.requireSite(siteId);
    return of(
      calculatePlaquePenalty(
        site.plaqueFidelityEndsAt,
        today,
        this.state.platformConfig.plaqueValueCentavos,
        this.state.platformConfig.plaquePenaltyPct,
      ),
    );
  }

  cancelSite(siteId: string, today: Date): Observable<Cancellation> {
    const existing = this.state.cancellations.find((item) => item.siteId === siteId);
    if (existing) {
      return of(structuredClone(existing));
    }

    const site = this.requireSite(siteId);
    const subscription = this.state.subscriptions.find((item) => item.siteId === siteId);
    const quote = calculatePlaquePenalty(
      site.plaqueFidelityEndsAt,
      today,
      this.state.platformConfig.plaqueValueCentavos,
      this.state.platformConfig.plaquePenaltyPct,
    );
    const order: Order = {
      id: `order_penalty_${siteId}`,
      customerId: site.customerId,
      resellerId: site.resellerId,
      siteId,
      planId: site.planId,
      couponId: null,
      valorBruto: quote.multaCentavos,
      desconto: 0,
      valorLiquido: quote.multaCentavos,
      status: 'PENDING',
    };
    const cancellation: Cancellation = {
      id: `cancel_${siteId}`,
      siteId,
      subscriptionId: subscription?.id ?? '',
      plaqueValueCentavos: quote.plaqueValueCentavos,
      plaquePenaltyPct: quote.plaquePenaltyPct,
      diasRestantes: quote.diasRestantes,
      mesesRestantes: quote.mesesRestantes,
      multaCentavos: quote.multaCentavos,
      orderId: order.id,
      createdAt: today.toISOString(),
    };

    this.state.orders.push(order);
    this.state.cancellations.push(cancellation);
    return of(structuredClone(cancellation));
  }

  getOrder(orderId: string): Observable<Order | null> {
    return of(structuredClone(this.state.orders.find((item) => item.id === orderId) ?? null));
  }

  closeResellerInvoice(
    resellerId: string,
    mes: string,
    closedAt: string,
  ): Observable<ResellerInvoice> {
    const existing = this.state.resellerInvoices.find(
      (item) => item.resellerId === resellerId && item.mes === mes,
    );
    if (existing) {
      return of(structuredClone(existing));
    }

    const reseller = this.state.resellers.find((item) => item.id === resellerId);
    if (!reseller) {
      throw new Error('reseller not found');
    }
    const plan = this.state.resellerPlans.find((item) => item.id === reseller.resellerPlanId);
    if (!plan) {
      throw new Error('reseller plan not found');
    }

    const activeSiteIds = this.state.sites
      .filter((item) => item.resellerId === resellerId && ACTIVE_SITE_STATUSES.has(item.status))
      .map((item) => item.id);
    const invoice: ResellerInvoice = {
      id: `inv_${resellerId}_${mes}`,
      resellerId,
      mes,
      closedAt,
      mensalidadeCentavos: plan.mensalidadeCentavos,
      custoPorSiteAtivoCentavos: plan.custoPorSiteAtivoCentavos,
      activeSiteIds,
      totalCentavos:
        plan.mensalidadeCentavos + activeSiteIds.length * plan.custoPorSiteAtivoCentavos,
    };
    this.state.resellerInvoices.push(invoice);
    return of(structuredClone(invoice));
  }

  recordNotice(notice: NoticeLog): Observable<NoticeRecord> {
    const existing = this.state.notices.find(
      (item) =>
        item.entityType === notice.entityType &&
        item.entityId === notice.entityId &&
        item.kind === notice.kind &&
        item.localDate === notice.localDate,
    );
    if (existing) {
      return of({ notice: structuredClone(existing), created: false });
    }
    this.state.notices.push({ ...notice });
    return of({ notice: structuredClone(notice), created: true });
  }

  canCreateSite(resellerId: string): Observable<boolean> {
    const reseller = this.state.resellers.find((item) => item.id === resellerId);
    if (!reseller) {
      throw new Error('reseller not found');
    }
    return of(reseller.status === 'ACTIVE');
  }

  blockReseller(resellerId: string, command: BlockResellerCommand): Observable<Reseller> {
    const reason = command.reason.trim();
    if (!reason) {
      throw new Error('blockReason is required');
    }
    const reseller = this.state.resellers.find((item) => item.id === resellerId);
    if (!reseller) {
      throw new Error('reseller not found');
    }

    for (const siteId of command.siteIds) {
      const site = this.requireSite(siteId);
      if (site.resellerId !== resellerId) {
        throw new Error('site is not owned by reseller');
      }
      site.status = 'SUSPENDED';
    }

    reseller.status = 'BLOCKED';
    reseller.blockReason = reason;
    reseller.blockedAt = command.blockedAt;
    this.state.auditLogs.push({
      actor: command.actorId,
      acao: 'reseller.block',
      entidade: `Reseller:${resellerId}`,
      diff: { reason, siteIds: [...command.siteIds], status: 'BLOCKED' },
    });
    return of(structuredClone(reseller));
  }

  unblockReseller(resellerId: string, actorId: string, unblockedAt: string): Observable<Reseller> {
    const reseller = this.state.resellers.find((item) => item.id === resellerId);
    if (!reseller) {
      throw new Error('reseller not found');
    }
    if (reseller.status !== 'BLOCKED') {
      throw new Error('reseller is not blocked');
    }
    const suspendedIds = this.state.sites
      .filter((site) => site.resellerId === resellerId && site.status === 'SUSPENDED')
      .map((site) => site.id);
    reseller.status = 'ACTIVE';
    reseller.blockedAt = null;
    this.state.auditLogs.push({
      actor: actorId,
      acao: 'reseller.unblock',
      entidade: `Reseller:${resellerId}`,
      diff: { unblockedAt, status: 'ACTIVE', stillSuspended: suspendedIds },
    });
    return of(structuredClone(reseller));
  }

  offerMigration(resellerId: string, actorId: string, today: Date): Observable<AuditLog> {
    const reseller = this.state.resellers.find((item) => item.id === resellerId);
    if (!reseller) {
      throw new Error('reseller not found');
    }
    if (
      !migrationAvailable(
        reseller.status,
        reseller.delinquentSince,
        today,
        this.state.platformConfig.resellerGraceDays,
      )
    ) {
      throw new Error('migration is not available');
    }
    const log: AuditLog = {
      actor: actorId,
      acao: 'reseller.offer-migration',
      entidade: `Reseller:${resellerId}`,
      diff: { delinquentSince: reseller.delinquentSince },
    };
    this.state.auditLogs.push(log);
    return of(structuredClone(log));
  }

  setSiteStatus(siteId: string, status: 'PUBLISHED' | 'SUSPENDED'): Observable<Site> {
    const site = this.requireSite(siteId);
    if (site.status === 'ARCHIVED' || site.status === 'DRAFT') {
      throw new Error('site cannot change status');
    }
    site.status = status;
    return of(structuredClone(site));
  }

  savePlan(plan: Plan): Observable<Plan> {
    const next = { ...plan, id: plan.id || `plan_${plan.code.toLowerCase()}` };
    const index = this.state.plans.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.state.plans[index] = next;
    } else {
      this.state.plans.push(next);
    }
    return of(structuredClone(next));
  }

  saveCoupon(coupon: Coupon): Observable<Coupon> {
    const next = { ...coupon, id: coupon.id || `cup_${coupon.code.toLowerCase()}` };
    const index = this.state.coupons.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.state.coupons[index] = next;
    } else {
      this.state.coupons.push(next);
    }
    return of(structuredClone(next));
  }

  deleteCoupon(couponId: string): Observable<void> {
    this.state.coupons = this.state.coupons.filter((item) => item.id !== couponId);
    return of(undefined);
  }

  requestCustomerOtp(
    email: string,
  ): Observable<{ delivered: boolean; previewCode: string | null }> {
    const user = this.customerUser(email);
    this.otpEmail = user?.email ?? null;
    return of({ delivered: Boolean(user), previewCode: user ? CUSTOMER_OTP : null });
  }

  verifyCustomerOtp(email: string, code: string): Observable<User> {
    const user = this.customerUser(email);
    if (!user || this.otpEmail !== user.email || code.trim() !== CUSTOMER_OTP) {
      throw new Error('invalid code');
    }
    return of(structuredClone(user));
  }

  listMySites(): Observable<Site[]> {
    const userId = this.auth?.me()?.id;
    if (!userId) {
      return of([]);
    }
    const customer = this.state.customers.find((item) => item.userId === userId);
    if (!customer) {
      return of([]);
    }
    return of(structuredClone(this.state.sites.filter((site) => site.customerId === customer.id)));
  }

  listSitesByCustomer(customerId: string): Observable<Site[]> {
    return of(structuredClone(this.state.sites.filter((site) => site.customerId === customerId)));
  }

  listCustomerTemplates(): Observable<Template[]> {
    return this.listTemplates();
  }

  updateSiteContent(siteId: string, content: SiteContent, templateId: string): Observable<Site> {
    const site = this.requireEditable(siteId);
    site.content = structuredClone(content);
    site.templateId = templateId;
    return of(structuredClone(site));
  }

  publishSite(siteId: string): Observable<Site> {
    const site = this.requireEditable(siteId);
    site.status = 'PUBLISHED';
    site.publishedAt = site.publishedAt ?? toCivilDate(new Date());
    return of(structuredClone(site));
  }

  presignCustomerUpload(body: {
    contentType: string;
    contentLength: number;
    filename?: string;
  }): Observable<CustomerUploadPresign> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const maxBytes = 5 * 1024 * 1024;
    if (!allowed.has(body.contentType)) {
      return throwError(() => ({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Tipo de arquivo não permitido',
        },
      }));
    }
    if (body.contentLength > maxBytes) {
      return throwError(() => ({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Arquivo muito grande',
        },
      }));
    }
    const key = `resellers/customer/${body.filename ?? 'foto'}`;
    return of({
      method: 'POST',
      uploadUrl: 'https://upload.example.local',
      fields: { key, 'Content-Type': body.contentType },
      publicUrl: `https://cdn.example.local/${key}`,
      key,
      contentType: body.contentType,
      maxBytes,
      expiresIn: 300,
    });
  }

  requestSiteChange(siteId: string, actorId: string, note: string): Observable<AuditLog> {
    const reason = note.trim();
    if (!reason) {
      throw new Error('change note is required');
    }
    this.requireSite(siteId);
    return of(this.audit(actorId, 'customer.request-change', siteId, { note: reason }));
  }

  requestMonthlyPlan(siteId: string, actorId: string): Observable<AuditLog> {
    this.requireSite(siteId);
    return of(this.audit(actorId, 'customer.request-monthly', siteId, {}));
  }

  listAuditLogs(): Observable<AuditLog[]> {
    return of(structuredClone(this.state.auditLogs));
  }

  private requireSite(siteId: string): Site {
    const site = this.state.sites.find((item) => item.id === siteId);
    if (!site) {
      throw new Error('site not found');
    }
    return site;
  }

  private requireEditable(siteId: string): Site {
    const site = this.requireSite(siteId);
    if (!canEditSite(site)) {
      throw new Error('site cannot be edited');
    }
    return site;
  }

  private customerUser(email: string): User | undefined {
    const normalized = email.trim().toLowerCase();
    return this.state.users.find(
      (user) => user.email.toLowerCase() === normalized && user.role === 'CUSTOMER',
    );
  }

  private audit(
    actorId: string,
    acao: string,
    siteId: string,
    diff: Record<string, unknown>,
  ): AuditLog {
    const log: AuditLog = { actor: actorId, acao, entidade: `Site:${siteId}`, diff };
    this.state.auditLogs.push(log);
    return structuredClone(log);
  }

  quoteShipping(destinationCep: string, _quantity?: number): Observable<ShippingQuoteResult> {
    const digits = destinationCep.replace(/\D/g, '');
    if (digits.length !== 8) {
      return of({ originCep: '38035-080', options: [] });
    }
    return of({
      originCep: '38035-080',
      options: [
        {
          serviceId: '1',
          name: 'PAC (exemplo)',
          company: 'Correios',
          priceCents: 2_490,
          deliveryDays: 8,
        },
        {
          serviceId: '2',
          name: 'SEDEX (exemplo)',
          company: 'Correios',
          priceCents: 4_190,
          deliveryDays: 3,
        },
      ],
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
    _idempotencyKey: string,
  ): Observable<CheckoutResult> {
    const site = this.state.sites.find((item) => item.id === command.siteId);
    const plan = this.state.plans.find((item) => item.id === (site?.planId ?? ''));
    let amountCents = plan?.precoCentavos ?? 34_700;
    let shippingCents = 0;
    if (command.destinationCep && command.shippingServiceId) {
      shippingCents = command.shippingServiceId === '2' ? 4_190 : 2_490;
      amountCents += shippingCents;
    }
    const gatewayPaymentId = `pay_checkout_${this.checkoutByGateway.size + 1}`;
    const result: CheckoutResult = {
      orderId: `order_${gatewayPaymentId}`,
      paymentId: `payment_${gatewayPaymentId}`,
      gatewayPaymentId,
      amountCents,
      shippingCents,
      shippingServiceId: command.shippingServiceId ?? null,
      method: command.method,
      status: 'PENDING',
      pixQrCode: command.method === 'PIX' ? 'mock-qr' : null,
      pixCopyPaste: command.method === 'PIX' ? '00020126MOCKCHECKOUTPIX' : null,
      invoiceUrl:
        command.method === 'CARD'
          ? `https://sandbox.asaas.com/i/${gatewayPaymentId}`
          : `https://sandbox.asaas.com/i/${gatewayPaymentId}`,
      bankSlipUrl:
        command.method === 'BOLETO' ? `https://sandbox.asaas.com/b/${gatewayPaymentId}` : null,
    };
    this.checkoutByGateway.set(gatewayPaymentId, result);
    return of(structuredClone(result));
  }

  getPaymentStatus(gatewayPaymentId: string): Observable<PaymentStatusView> {
    const checkout = this.checkoutByGateway.get(gatewayPaymentId);
    if (checkout) {
      return of({
        gatewayPaymentId,
        status: checkout.status,
        amountCents: checkout.amountCents,
        invoiceUrl: checkout.invoiceUrl,
        bankSlipUrl: checkout.bankSlipUrl,
      });
    }
    const invoice = this.myInvoices.find((item) => item.gatewayPaymentId === gatewayPaymentId);
    if (invoice) {
      return of({
        gatewayPaymentId,
        status: invoice.paymentStatus ?? 'PENDING',
        amountCents: invoice.totalCents,
        invoiceUrl: invoice.invoiceUrl,
        bankSlipUrl: invoice.bankSlipUrl,
      });
    }
    return throwError(() => new Error('payment not found'));
  }

  /** Test helper: mark checkout paid so polling specs can assert. */
  markCheckoutPaid(gatewayPaymentId: string): void {
    const current = this.checkoutByGateway.get(gatewayPaymentId);
    if (current) {
      this.checkoutByGateway.set(gatewayPaymentId, { ...current, status: 'RECEIVED' });
    }
  }

  listMyInvoices(): Observable<MyResellerInvoice[]> {
    return of(structuredClone(this.myInvoices));
  }

  getMyInvoice(id: string): Observable<MyResellerInvoice> {
    const found = this.myInvoices.find((item) => item.id === id);
    if (!found) {
      return throwError(() => new Error('invoice not found'));
    }
    return of(structuredClone(found));
  }

  getResellerDashboard(): Observable<ResellerDashboardDto> {
    const resellerId = RESELLER_TRIANGULO;
    const sites = this.state.sites.filter((site) => site.resellerId === resellerId);
    const activeSites = sites.filter(
      (site) => site.status === 'PUBLISHED' || site.status === 'READ_ONLY',
    ).length;
    const monthSalesCents = this.state.payments
      .filter((payment) => payment.resellerId === resellerId && payment.status === 'PAID')
      .reduce((sum, payment) => sum + payment.valor, 0);
    return of({
      activeSites,
      monthSalesCents,
      predictedMarginCents: Math.round(monthSalesCents * 0.35),
      realizedMarginCents: Math.round(monthSalesCents * 0.3),
      balanceCents: monthSalesCents,
      stock: this.state.plaqueStock
        .filter((row) => row.resellerId === resellerId)
        .map((row) => ({ plaqueType: row.tipo, qty: row.qtd })),
      openInvoice: this.myInvoices[0]
        ? {
            id: this.myInvoices[0].id,
            period: this.myInvoices[0].period,
            totalCents: this.myInvoices[0].totalCents,
            status: this.myInvoices[0].status,
          }
        : null,
      monthFrom: '2026-10-01T03:00:00.000Z',
      monthToExclusive: '2026-11-01T03:00:00.000Z',
    });
  }

  listResellerCustomers(_cursor?: string | null): Observable<CursorPage<ResellerCustomerDto>> {
    const items = this.state.customers
      .filter((customer) => customer.resellerId === RESELLER_TRIANGULO)
      .map((customer): ResellerCustomerDto => ({
        id: customer.id,
        resellerId: customer.resellerId ?? RESELLER_TRIANGULO,
        name: customer.nome,
        doc: customer.doc,
        whatsapp: customer.whatsapp,
        city: customer.cidade,
      }));
    return of({ items: structuredClone(items), nextCursor: null });
  }

  createResellerCustomer(body: {
    name: string;
    doc?: string;
    whatsapp?: string;
    city?: string;
    email?: string;
  }): Observable<ResellerCustomerDto> {
    const customer: Customer = {
      id: `cust_created_${this.state.customers.length + 1}`,
      userId: null,
      resellerId: RESELLER_TRIANGULO,
      nome: body.name.trim(),
      doc: (body.doc ?? '').trim(),
      whatsapp: (body.whatsapp ?? '').trim(),
      cidade: (body.city ?? '').trim(),
    };
    this.state.customers.push(customer);
    return of({
      id: customer.id,
      resellerId: RESELLER_TRIANGULO,
      name: customer.nome,
      doc: customer.doc,
      whatsapp: customer.whatsapp,
      city: customer.cidade,
    });
  }

  listResellerSites(_cursor?: string | null): Observable<CursorPage<ResellerSiteDto>> {
    const items = this.state.sites
      .filter((site) => site.resellerId === RESELLER_TRIANGULO)
      .map((site) => this.toResellerSiteDto(site));
    return of({ items: structuredClone(items), nextCursor: null });
  }

  createResellerSite(body: {
    customerId: string;
    slug: string;
    templateId: string;
    planId: string;
    content?: Record<string, unknown>;
  }): Observable<ResellerSiteDto> {
    return this.createSite({
      customerId: body.customerId,
      slug: body.slug,
      templateId: body.templateId,
      planId: body.planId,
      businessName: body.slug,
      phone: '',
      address: { logradouro: '', cidade: 'Uberaba', uf: 'MG' },
    }).pipe(map((site) => this.toResellerSiteDto(site)));
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
    const site = this.state.sites.find((item) => item.id === siteId);
    if (!site) {
      return throwError(() => new Error('not found'));
    }
    if (body.templateId) site.templateId = body.templateId;
    if (body.planId) site.planId = body.planId;
    if (body.slug) site.slug = body.slug;
    return of(this.toResellerSiteDto(site));
  }

  publishResellerSite(siteId: string): Observable<ResellerSiteDto> {
    return this.publishSite(siteId).pipe(map((site) => this.toResellerSiteDto(site)));
  }

  unpublishResellerSite(siteId: string): Observable<ResellerSiteDto> {
    const site = this.state.sites.find((item) => item.id === siteId);
    if (!site) {
      return throwError(() => new Error('not found'));
    }
    site.status = 'DRAFT';
    return of(this.toResellerSiteDto(site));
  }

  checkResellerSlug(slug: string): Observable<SlugCheckDto> {
    const normalized = slug.trim().toLowerCase();
    const taken =
      this.state.reservedSlugs.some((item) => item.slug === normalized) ||
      this.state.sites.some((item) => item.slug === normalized);
    return of({
      slug: normalized,
      available: !taken && /^[a-z0-9](?:-?[a-z0-9]){2,30}$/.test(normalized),
      code: taken ? 'SLUG_TAKEN' : undefined,
    });
  }

  listResellerSiteOptions(): Observable<SiteOptionsDto> {
    return of({
      plans: this.state.plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.nome,
        type: plan.tipo,
        priceCents: plan.precoCentavos,
      })),
      templates: this.state.templates.map((template) => ({
        id: template.id,
        key: template.key,
        name: template.nome,
        niche: template.ramo,
      })),
    });
  }

  listResellerSales(_cursor?: string | null): Observable<CursorPage<ResellerSaleDto>> {
    const items: ResellerSaleDto[] = this.state.payments
      .filter((payment) => payment.resellerId === RESELLER_TRIANGULO)
      .map((payment) => ({
        id: payment.id,
        resellerId: RESELLER_TRIANGULO,
        createdAt: payment.paidAt ?? '2026-10-01T12:00:00.000Z',
        predictedMarginCents: Math.round(payment.valor * 0.35),
        items: [
          {
            productId: 'prod_mock',
            qty: 1,
            unitCostCents: Math.round(payment.valor * 0.65),
            unitPriceCents: payment.valor,
          },
        ],
      }));
    return of({ items, nextCursor: null });
  }

  private readonly saleByIdempotency = new Map<string, ResellerSaleDto>();

  recordResellerSale(
    items: { productId: string; qty: number; unitPriceCents: number }[],
    idempotencyKey: string,
  ): Observable<ResellerSaleDto> {
    const cached = this.saleByIdempotency.get(idempotencyKey);
    if (cached) {
      return of(structuredClone(cached));
    }
    const predictedMarginCents = items.reduce(
      (sum, item) => sum + item.qty * Math.round(item.unitPriceCents * 0.35),
      0,
    );
    const sale: ResellerSaleDto = {
      id: `sale_${Date.now()}`,
      resellerId: RESELLER_TRIANGULO,
      createdAt: new Date().toISOString(),
      predictedMarginCents,
      items: items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        unitCostCents: Math.round(item.unitPriceCents * 0.65),
        unitPriceCents: item.unitPriceCents,
      })),
    };
    this.saleByIdempotency.set(idempotencyKey, sale);
    return of(structuredClone(sale));
  }

  getResellerLedger(_opts?: {
    from?: string;
    to?: string;
    cursor?: string | null;
  }): Observable<LedgerStatementDto> {
    const sales = this.state.payments.filter(
      (payment) => payment.resellerId === RESELLER_TRIANGULO && payment.status === 'PAID',
    );
    const items = sales.map((payment) => ({
      id: `led_${payment.id}`,
      resellerId: RESELLER_TRIANGULO,
      type: 'IN' as const,
      category: 'SALE',
      amountCents: payment.valor,
      refType: 'Payment',
      refId: payment.id,
      reversalOfId: null,
      createdAt: payment.paidAt ?? '2026-10-01T12:00:00.000Z',
    }));
    const closingCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    return of({ items, nextCursor: null, openingCents: 0, closingCents });
  }

  listResellerPlaqueStock(): Observable<{ items: PlaqueStockItemDto[] }> {
    return of({
      items: this.state.plaqueStock
        .filter((row) => row.resellerId === RESELLER_TRIANGULO)
        .map((row) => ({
          plaqueType: row.tipo,
          qty: row.qtd,
          avgCostCents: row.custoMedio,
        })),
    });
  }

  private readonly plaqueMoveByKey = new Map<string, PlaqueMovementDto>();

  listResellerPlaqueMovements(_cursor?: string | null): Observable<CursorPage<PlaqueMovementDto>> {
    return of({
      items: [...this.plaqueMoveByKey.values()].reverse(),
      nextCursor: null,
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
    const cached = this.plaqueMoveByKey.get(idempotencyKey);
    if (cached) {
      return of(structuredClone(cached));
    }
    const stock = this.state.plaqueStock.find(
      (row) => row.resellerId === RESELLER_TRIANGULO && row.tipo === body.plaqueType,
    );
    if (body.type === 'OUT') {
      if (!stock || stock.qtd < body.qty) {
        return throwError(() => ({ status: 409, error: { code: 'STOCK_INSUFFICIENT' } }));
      }
      stock.qtd -= body.qty;
    } else {
      if (stock) {
        stock.qtd += body.qty;
      } else {
        this.state.plaqueStock.push({
          resellerId: RESELLER_TRIANGULO,
          tipo: body.plaqueType,
          qtd: body.qty,
          custoMedio: body.unitCostCents ?? 0,
        });
      }
    }
    const movement: PlaqueMovementDto = {
      id: `pm_${Date.now()}`,
      resellerId: RESELLER_TRIANGULO,
      type: body.type,
      plaqueType: body.plaqueType,
      qty: body.qty,
      unitCostCents: body.type === 'IN' ? (body.unitCostCents ?? null) : null,
      siteId: body.type === 'OUT' ? body.siteId : null,
      reason: body.type === 'OUT' ? body.reason : (body.reason ?? null),
      createdAt: new Date().toISOString(),
    };
    this.plaqueMoveByKey.set(idempotencyKey, movement);
    return of(structuredClone(movement));
  }

  getResellerLedgerBalance(): Observable<{ balanceCents: number }> {
    return this.getResellerLedger().pipe(
      map((statement) => ({ balanceCents: statement.closingCents })),
    );
  }

  listResellerWholesale(): Observable<{ items: WholesaleItemDto[] }> {
    return of({
      items: this.state.plans.map((plan) => ({
        productId: plan.id,
        code: plan.code,
        name: plan.nome,
        baseWholesaleCents: Math.round(plan.precoCentavos * 0.2),
        priceCents: plan.precoCentavos,
        source: 'mock',
      })),
    });
  }

  listResellerPrices(): Observable<{ items: ResellerPriceItemDto[] }> {
    return this.listResellerWholesale().pipe(
      map((body) => ({
        items: body.items.map((item) => ({
          productId: item.productId,
          code: item.code,
          name: item.name,
          priceCents: item.priceCents,
        })),
      })),
    );
  }

  getReseller(id: string): Observable<Reseller> {
    const row = this.state.resellers.find((item) => item.id === id);
    if (!row) {
      return throwError(() => new Error('reseller not found'));
    }
    return of(structuredClone(row));
  }

  getResellerSummary(id: string): Observable<ResellerSummaryDto> {
    const reseller = this.state.resellers.find((item) => item.id === id);
    if (!reseller) {
      return throwError(() => new Error('reseller not found'));
    }
    const stock = this.state.plaqueStock
      .filter((row) => row.resellerId === id)
      .map((row) => ({ plaque_type: row.tipo, qty: row.qtd }));
    return of({
      id: reseller.id,
      name: reseller.nome,
      status: reseller.status,
      sites: this.state.sites.filter((site) => site.resellerId === id).length,
      sales: this.state.payments.filter((payment) => payment.resellerId === id).length,
      stock,
    });
  }

  suspendResellerSites(id: string): Observable<{ count: number }> {
    let count = 0;
    for (const site of this.state.sites) {
      if (
        site.resellerId === id &&
        (site.status === 'PUBLISHED' || site.status === 'READ_ONLY' || site.status === 'DRAFT')
      ) {
        site.status = 'SUSPENDED';
        count += 1;
      }
    }
    return of({ count });
  }

  impersonateReseller(id: string): Observable<ImpersonateResultDto> {
    const reseller = this.state.resellers.find((item) => item.id === id);
    if (!reseller) {
      return throwError(() => new Error('reseller not found'));
    }
    return of({
      mode: 'read',
      resellerId: reseller.id,
      name: reseller.nome,
      status: reseller.status,
    });
  }

  listAdminProducts(): Observable<AdminProductDto[]> {
    return of(structuredClone(this.adminProducts));
  }

  listResellerWholesaleAdmin(resellerId: string): Observable<ResellerWholesaleAdminDto> {
    const rows = this.wholesaleByReseller.get(resellerId) ?? [];
    const current = rows.filter((row) => row.validTo == null);
    const history = rows.filter((row) => row.validTo != null);
    return of({
      resellerId,
      asOf: new Date().toISOString(),
      current: structuredClone(current),
      history: structuredClone(history),
    });
  }

  setResellerWholesale(
    resellerId: string,
    body: SetWholesaleCommand,
  ): Observable<WholesalePriceRowDto> {
    const product = this.adminProducts.find((item) => item.id === body.productId);
    const rows = this.wholesaleByReseller.get(resellerId) ?? [];
    for (const row of rows) {
      if (row.productId === body.productId && row.validTo == null) {
        row.validTo = body.validFrom;
      }
    }
    const created: WholesalePriceRowDto = {
      id: `wp_${rows.length + 1}`,
      productId: body.productId,
      code: product?.code ?? '',
      name: product?.name ?? '',
      priceCents: body.priceCents,
      validFrom: body.validFrom,
      validTo: body.validTo ?? null,
    };
    rows.push(created);
    this.wholesaleByReseller.set(resellerId, rows);
    return of(structuredClone(created));
  }

  getAdminPlaqueStock(resellerId: string): Observable<PlaqueStockRowDto[]> {
    return of(
      this.state.plaqueStock
        .filter((row) => row.resellerId === resellerId)
        .map((row) => ({
          plaqueType: row.tipo,
          qty: row.qtd,
          avgCostCents: row.custoMedio,
        })),
    );
  }

  listAdminPlaqueMovements(
    resellerId: string,
    _cursor?: string | null,
  ): Observable<CursorPage<AdminPlaqueMovementDto>> {
    return of({
      items: this.plaqueMoves.filter((row) => row.resellerId === resellerId),
      nextCursor: null,
    });
  }

  postAdminPlaqueMovement(
    body: AdminPlaqueMoveCommand,
    _idempotencyKey: string,
  ): Observable<AdminPlaqueMovementDto> {
    const stock = this.state.plaqueStock.find(
      (row) => row.resellerId === body.resellerId && row.tipo === body.plaqueType,
    );
    if (stock) {
      stock.qtd += body.type === 'IN' ? body.qty : body.qty;
    } else {
      this.state.plaqueStock.push({
        resellerId: body.resellerId,
        tipo: body.plaqueType,
        qtd: body.qty,
        custoMedio: body.unitCostCents ?? 0,
      });
    }
    const move: AdminPlaqueMovementDto = {
      id: `pm_${this.plaqueMoves.length + 1}`,
      resellerId: body.resellerId,
      type: body.type,
      plaqueType: body.plaqueType,
      qty: body.qty,
      unitCostCents: body.unitCostCents ?? null,
      reason: body.reason ?? null,
      createdAt: new Date().toISOString(),
    };
    this.plaqueMoves.push(move);
    return of(structuredClone(move));
  }

  transferPlaques(body: TransferPlaquesCommand, _idempotencyKey: string): Observable<unknown> {
    const from = this.state.plaqueStock.find(
      (row) => row.resellerId === RESELLER_TRIANGULO && row.tipo === body.plaqueType,
    );
    if (!from || from.qtd < body.qty) {
      return throwError(() => new Error('STOCK_INSUFFICIENT'));
    }
    from.qtd -= body.qty;
    const to = this.state.plaqueStock.find(
      (row) => row.resellerId === body.toResellerId && row.tipo === body.plaqueType,
    );
    if (to) {
      to.qtd += body.qty;
    } else {
      this.state.plaqueStock.push({
        resellerId: body.toResellerId,
        tipo: body.plaqueType,
        qtd: body.qty,
        custoMedio: from.custoMedio,
      });
    }
    return of({ ok: true });
  }

  private toResellerSiteDto(site: Site): ResellerSiteDto {
    const customer = this.state.customers.find((item) => item.id === site.customerId);
    const plan = this.state.plans.find((item) => item.id === site.planId);
    const template = this.state.templates.find((item) => item.id === site.templateId);
    return {
      id: site.id,
      resellerId: site.resellerId ?? RESELLER_TRIANGULO,
      customerId: site.customerId,
      slug: site.slug,
      templateId: site.templateId,
      planId: site.planId,
      status: site.status,
      editable: site.editable,
      content: site.content,
      publishedAt: site.publishedAt,
      hostingRenewsAt: site.hostingRenewsAt,
      plaqueFidelityEndsAt: site.plaqueFidelityEndsAt,
      customer: customer ? { id: customer.id, name: customer.nome } : undefined,
      plan: plan
        ? {
            id: plan.id,
            code: plan.code,
            name: plan.nome,
            priceCents: plan.precoCentavos,
          }
        : undefined,
      template: template ? { id: template.id, key: template.key, name: template.nome } : undefined,
    };
  }

  private byReseller<T extends { resellerId: string | null }>(
    rows: T[],
    resellerId?: string | null,
  ): T[] {
    if (resellerId === undefined) {
      return rows;
    }
    return rows.filter((row) => row.resellerId === resellerId);
  }
}

function draftContent(command: CreateSiteCommand, slug: string): SiteContent {
  const theme: SiteTheme = {
    p1: '#1e3a5f',
    p2: '#3d5a4c',
    p3: '#d5e2dc',
    on3: '#102018',
    hi: '#f4f7f6',
    fontHeading: 'Fraunces, Palatino, serif',
    fontBody: 'Literata, Georgia, serif',
    fontScale: 1,
    italic: 'normal',
  };
  return {
    businessName: command.businessName.trim(),
    profile: {
      nome: command.businessName.trim(),
      cidade: command.address.cidade.trim(),
      uf: command.address.uf.trim(),
    },
    theme,
    address: {
      logradouro: command.address.logradouro.trim(),
      cidade: command.address.cidade.trim(),
      uf: command.address.uf.trim(),
      cep: command.address.cep?.trim() || undefined,
    },
    phone: command.phone.trim(),
    seo: { title: command.businessName.trim(), description: slug },
  };
}
