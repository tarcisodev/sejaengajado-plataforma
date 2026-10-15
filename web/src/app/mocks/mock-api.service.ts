import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

import {
  ApiPort,
  BlockResellerCommand,
  CreateCustomerCommand,
  CreateResellerCommand,
  CreateSiteCommand,
  NoticeRecord,
} from '../core/api/api-port';
import {
  calculatePlaquePenalty,
  PlaquePenaltyQuote,
  toCivilDate,
} from '../core/api/plaque-penalty';
import { migrationAvailable } from '../core/admin/migration';
import { canEditSite } from '../core/customer/access';
import {
  AuditLog,
  Cancellation,
  Coupon,
  Customer,
  NoticeLog,
  Order,
  Payment,
  Plan,
  PlatformConfig,
  Reseller,
  ResellerInvoice,
  ResellerPlan,
  Site,
  SiteContent,
  SiteTheme,
  Template,
  User,
} from '../core/models/domain';
import { createUberabaSeed, MockDatabase } from './uberaba-seed';

const ACTIVE_SITE_STATUSES = new Set<Site['status']>(['PUBLISHED', 'READ_ONLY']);
const CUSTOMER_OTP = '482913';

@Injectable({ providedIn: 'root' })
export class MockApiService implements ApiPort {
  private readonly state: MockDatabase = createUberabaSeed();
  private otpEmail: string | null = null;

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

  createReseller(command: CreateResellerCommand): Observable<Reseller> {
    const reseller: Reseller = {
      id: `res_created_${this.state.resellers.length + 1}`,
      userId: command.userId.trim(),
      nome: command.nome.trim(),
      resellerPlanId: command.resellerPlanId,
      status: 'ACTIVE',
      delinquentSince: null,
      blockedAt: null,
      blockReason: null,
      asaasWalletId: null,
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

  listSitesByCustomer(customerId: string): Observable<Site[]> {
    return of(structuredClone(this.state.sites.filter((site) => site.customerId === customerId)));
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
