import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';
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
  Template,
  User,
} from '../models/domain';
import { PlaquePenaltyQuote } from './plaque-penalty';
import {
  ApiPort,
  BlockResellerCommand,
  CreateCustomerCommand,
  CreateResellerCommand,
  CreateSiteCommand,
  CustomerOtp,
  NoticeRecord,
} from './api-port';

@Injectable()
export class HttpApiService implements ApiPort {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  getPlatformConfig(): Observable<PlatformConfig> {
    return this.http.get<PlatformConfig>(this.url('/platform-config'));
  }

  updatePlatformConfig(patch: Partial<PlatformConfig>): Observable<PlatformConfig> {
    return this.http.patch<PlatformConfig>(this.url('/platform-config'), patch);
  }

  listPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(this.url('/plans'));
  }

  listTemplates(): Observable<Template[]> {
    return this.http.get<Template[]>(this.url('/templates'));
  }

  listCoupons(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(this.url('/coupons'));
  }

  listResellers(): Observable<Reseller[]> {
    return this.http.get<Reseller[]>(this.url('/resellers'));
  }

  listResellerPlans(): Observable<ResellerPlan[]> {
    return this.http.get<ResellerPlan[]>(this.url('/reseller-plans'));
  }

  createReseller(command: CreateResellerCommand): Observable<Reseller> {
    return this.http.post<Reseller>(this.url('/resellers'), command);
  }

  listCustomers(resellerId?: string | null): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.url('/customers'), { params: this.scope(resellerId) });
  }

  createCustomer(command: CreateCustomerCommand): Observable<Customer> {
    return this.http.post<Customer>(this.url('/customers'), command);
  }

  listSites(resellerId?: string | null): Observable<Site[]> {
    return this.http.get<Site[]>(this.url('/sites'), { params: this.scope(resellerId) });
  }

  createSite(command: CreateSiteCommand): Observable<Site> {
    return this.http.post<Site>(this.url('/sites'), command);
  }

  listPayments(resellerId?: string | null): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.url('/payments'), { params: this.scope(resellerId) });
  }

  getSiteBySlug(slug: string): Observable<Site | null> {
    return this.http.get<Site>(this.url(`/public/sites/${slug}`)).pipe(catchError(() => of(null)));
  }

  quotePlaquePenalty(siteId: string, today: Date): Observable<PlaquePenaltyQuote> {
    return this.http.get<PlaquePenaltyQuote>(this.url(`/sites/${siteId}/plaque-penalty`), {
      params: new HttpParams().set('today', today.toISOString()),
    });
  }

  cancelSite(siteId: string, today: Date): Observable<Cancellation> {
    return this.http.post<Cancellation>(this.url(`/sites/${siteId}/cancel`), {
      today: today.toISOString(),
    });
  }

  getOrder(orderId: string): Observable<Order | null> {
    return this.http.get<Order>(this.url(`/orders/${orderId}`)).pipe(catchError(() => of(null)));
  }

  closeResellerInvoice(
    resellerId: string,
    mes: string,
    closedAt: string,
  ): Observable<ResellerInvoice> {
    return this.http.post<ResellerInvoice>(this.url(`/resellers/${resellerId}/invoices`), {
      mes,
      closedAt,
    });
  }

  recordNotice(notice: NoticeLog): Observable<NoticeRecord> {
    return this.http.post<NoticeRecord>(this.url('/notices'), notice);
  }

  canCreateSite(resellerId: string): Observable<boolean> {
    return this.http.get<boolean>(this.url(`/resellers/${resellerId}/can-create-site`));
  }

  blockReseller(resellerId: string, command: BlockResellerCommand): Observable<Reseller> {
    return this.http.post<Reseller>(this.url(`/resellers/${resellerId}/block`), command);
  }

  unblockReseller(resellerId: string, actorId: string, unblockedAt: string): Observable<Reseller> {
    return this.http.post<Reseller>(this.url(`/resellers/${resellerId}/unblock`), {
      actorId,
      unblockedAt,
    });
  }

  offerMigration(resellerId: string, actorId: string, today: Date): Observable<AuditLog> {
    return this.http.post<AuditLog>(this.url(`/resellers/${resellerId}/offer-migration`), {
      actorId,
      today: today.toISOString(),
    });
  }

  setSiteStatus(siteId: string, status: 'PUBLISHED' | 'SUSPENDED'): Observable<Site> {
    return this.http.patch<Site>(this.url(`/sites/${siteId}/status`), { status });
  }

  savePlan(plan: Plan): Observable<Plan> {
    return this.http.put<Plan>(this.url('/plans'), plan);
  }

  saveCoupon(coupon: Coupon): Observable<Coupon> {
    return this.http.put<Coupon>(this.url('/coupons'), coupon);
  }

  deleteCoupon(couponId: string): Observable<void> {
    return this.http.delete<void>(this.url(`/coupons/${couponId}`));
  }

  requestCustomerOtp(email: string): Observable<CustomerOtp> {
    return this.http.post<CustomerOtp>(this.url('/customer/otp'), { email });
  }

  verifyCustomerOtp(email: string, code: string): Observable<User> {
    return this.http.post<User>(this.url('/customer/otp/verify'), { email, code });
  }

  listSitesByCustomer(customerId: string): Observable<Site[]> {
    return this.http.get<Site[]>(this.url(`/customers/${customerId}/sites`));
  }

  updateSiteContent(siteId: string, content: SiteContent, templateId: string): Observable<Site> {
    return this.http.put<Site>(this.url(`/sites/${siteId}/content`), { content, templateId });
  }

  publishSite(siteId: string): Observable<Site> {
    return this.http.post<Site>(this.url(`/sites/${siteId}/publish`), {});
  }

  requestSiteChange(siteId: string, actorId: string, note: string): Observable<AuditLog> {
    return this.http.post<AuditLog>(this.url(`/sites/${siteId}/change-request`), {
      actorId,
      note,
    });
  }

  requestMonthlyPlan(siteId: string, actorId: string): Observable<AuditLog> {
    return this.http.post<AuditLog>(this.url(`/sites/${siteId}/monthly-plan`), { actorId });
  }

  listAuditLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.url('/audit-logs'));
  }

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  private scope(resellerId?: string | null): HttpParams {
    if (resellerId === undefined) {
      return new HttpParams();
    }
    return new HttpParams().set('resellerId', resellerId ?? '');
  }
}
