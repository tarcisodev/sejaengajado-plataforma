import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PlaquePenaltyQuote } from './plaque-penalty';
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
} from '../models/domain';

export interface BlockResellerCommand {
  actorId: string;
  reason: string;
  siteIds: string[];
  blockedAt: string;
}

export interface NoticeRecord {
  notice: NoticeLog;
  created: boolean;
}

export interface ApiPort {
  getPlatformConfig(): Observable<PlatformConfig>;
  updatePlatformConfig(patch: Partial<PlatformConfig>): Observable<PlatformConfig>;
  listPlans(): Observable<Plan[]>;
  listTemplates(): Observable<Template[]>;
  listCoupons(): Observable<Coupon[]>;
  listResellers(): Observable<Reseller[]>;
  listCustomers(resellerId?: string | null): Observable<Customer[]>;
  listSites(resellerId?: string | null): Observable<Site[]>;
  listPayments(resellerId?: string | null): Observable<Payment[]>;
  getSiteBySlug(slug: string): Observable<Site | null>;
  quotePlaquePenalty(siteId: string, today: Date): Observable<PlaquePenaltyQuote>;
  cancelSite(siteId: string, today: Date): Observable<Cancellation>;
  getOrder(orderId: string): Observable<Order | null>;
  closeResellerInvoice(
    resellerId: string,
    mes: string,
    closedAt: string,
  ): Observable<ResellerInvoice>;
  recordNotice(notice: NoticeLog): Observable<NoticeRecord>;
  canCreateSite(resellerId: string): Observable<boolean>;
  blockReseller(resellerId: string, command: BlockResellerCommand): Observable<Reseller>;
  unblockReseller(resellerId: string, actorId: string, unblockedAt: string): Observable<Reseller>;
  offerMigration(resellerId: string, actorId: string, today: Date): Observable<AuditLog>;
  setSiteStatus(siteId: string, status: 'PUBLISHED' | 'SUSPENDED'): Observable<Site>;
  savePlan(plan: Plan): Observable<Plan>;
  saveCoupon(coupon: Coupon): Observable<Coupon>;
  deleteCoupon(couponId: string): Observable<void>;
  listAuditLogs(): Observable<AuditLog[]>;
}

export const API_PORT = new InjectionToken<ApiPort>('API_PORT');
