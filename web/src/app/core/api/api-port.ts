import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { PlaquePenaltyQuote } from './plaque-penalty';
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
  SiteAddress,
  SiteContent,
  Template,
  User,
} from '../models/domain';

export interface CreateCustomerCommand {
  nome: string;
  doc: string;
  whatsapp: string;
  cidade: string;
  resellerId: string | null;
}

export interface CreateResellerCommand {
  nome: string;
  userId: string;
  resellerPlanId: string;
}

export interface CreateSiteCommand {
  customerId: string;
  slug: string;
  templateId: string;
  planId: string;
  businessName: string;
  phone: string;
  address: SiteAddress;
}

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
  listResellerPlans(): Observable<ResellerPlan[]>;
  createReseller(command: CreateResellerCommand): Observable<Reseller>;
  listCustomers(resellerId?: string | null): Observable<Customer[]>;
  createCustomer(command: CreateCustomerCommand): Observable<Customer>;
  listSites(resellerId?: string | null): Observable<Site[]>;
  createSite(command: CreateSiteCommand): Observable<Site>;
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
  requestCustomerOtp(email: string): Observable<CustomerOtp>;
  verifyCustomerOtp(email: string, code: string): Observable<User>;
  listSitesByCustomer(customerId: string): Observable<Site[]>;
  updateSiteContent(siteId: string, content: SiteContent, templateId: string): Observable<Site>;
  publishSite(siteId: string): Observable<Site>;
  requestSiteChange(siteId: string, actorId: string, note: string): Observable<AuditLog>;
  requestMonthlyPlan(siteId: string, actorId: string): Observable<AuditLog>;
  listAuditLogs(): Observable<AuditLog[]>;
  /** Direct Pronto checkout — amountCents comes from API only. */
  checkoutPronto(command: {
    siteId: string;
    customerName: string;
    customerEmail: string;
    couponCode?: string;
    method: PaymentMethod;
  }): Observable<CheckoutResult>;
  /** Poll payment status from API/gateway — never trust redirect. */
  getPaymentStatus(gatewayPaymentId: string): Observable<PaymentStatusView>;
  listMyInvoices(): Observable<MyResellerInvoice[]>;
  getMyInvoice(id: string): Observable<MyResellerInvoice>;
}

export interface CustomerOtp {
  delivered: boolean;
  previewCode: string | null;
}

export const API_PORT = new InjectionToken<ApiPort>('API_PORT');
