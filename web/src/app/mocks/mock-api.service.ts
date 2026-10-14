import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ApiPort, BlockResellerCommand, NoticeRecord } from '../core/api/api-port';
import { calculatePlaquePenalty, PlaquePenaltyQuote } from '../core/api/plaque-penalty';
import { migrationAvailable } from '../core/admin/migration';
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
  Site,
  Template,
} from '../core/models/domain';
import { createUberabaSeed, MockDatabase } from './uberaba-seed';

const ACTIVE_SITE_STATUSES = new Set<Site['status']>(['PUBLISHED', 'READ_ONLY']);

@Injectable({ providedIn: 'root' })
export class MockApiService implements ApiPort {
  private readonly state: MockDatabase = createUberabaSeed();

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

  listCustomers(resellerId?: string | null): Observable<Customer[]> {
    return of(structuredClone(this.byReseller(this.state.customers, resellerId)));
  }

  listSites(resellerId?: string | null): Observable<Site[]> {
    return of(structuredClone(this.byReseller(this.state.sites, resellerId)));
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
