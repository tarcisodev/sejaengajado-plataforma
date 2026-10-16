import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

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
  SiteAddress,
  SiteContent,
  SiteStatus,
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

/** Resposta de criar revendedor (convite Supabase). */
export interface CreateResellerResult extends Reseller {
  /** Link de convite/recovery para copiar em dev (e-mail capturado localmente). */
  inviteActionLink?: string | null;
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

export interface CustomerUploadPresign {
  method: 'POST';
  uploadUrl: string;
  fields: Record<string, string>;
  publicUrl: string;
  key: string;
  contentType: string;
  maxBytes: number;
  expiresIn: number;
}

export interface ApiPort {
  getPlatformConfig(): Observable<PlatformConfig>;
  updatePlatformConfig(patch: Partial<PlatformConfig>): Observable<PlatformConfig>;
  listPlans(): Observable<Plan[]>;
  listTemplates(): Observable<Template[]>;
  listCoupons(): Observable<Coupon[]>;
  listResellers(): Observable<Reseller[]>;
  listResellerPlans(): Observable<ResellerPlan[]>;
  createReseller(command: CreateResellerCommand): Observable<CreateResellerResult>;
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
  setSiteStatus(siteId: string, status: 'PUBLISHED' | 'SUSPENDED' | 'DRAFT' | 'ARCHIVED'): Observable<Site>;
  /** Admin: GET /admin/sites/:id (includes content). */
  getAdminSite(siteId: string): Observable<Site>;
  /** Admin: PATCH /admin/sites/:id/content */
  updateAdminSiteContent(
    siteId: string,
    content: SiteContent,
    templateId?: string,
  ): Observable<Site>;
  /** Admin: PATCH /admin/sites/:id (slug, plan, status, customer, reseller). */
  patchAdminSiteMeta(
    siteId: string,
    body: {
      slug?: string;
      planId?: string;
      status?: SiteStatus;
      customerId?: string;
      resellerId?: string;
    },
  ): Observable<Site>;
  publishAdminSite(siteId: string): Observable<Site>;
  unpublishAdminSite(siteId: string): Observable<Site>;
  archiveAdminSite(siteId: string): Observable<Site>;
  savePlan(plan: Plan): Observable<Plan>;
  saveCoupon(coupon: Coupon): Observable<Coupon>;
  deleteCoupon(couponId: string): Observable<void>;
  /** Envia link de redefinição de senha (legado do nome OTP). */
  requestCustomerOtp(email: string): Observable<CustomerOtp>;
  /** Login com e-mail + senha (segundo argumento = senha). */
  verifyCustomerOtp(email: string, password: string): Observable<User>;
  /** Sites do cliente autenticado (GET /customer/sites). */
  listMySites(): Observable<Site[]>;
  listSitesByCustomer(customerId: string): Observable<Site[]>;
  /** Templates ativos para o editor do cliente. */
  listCustomerTemplates(): Observable<Template[]>;
  updateSiteContent(siteId: string, content: SiteContent, templateId: string): Observable<Site>;
  publishSite(siteId: string): Observable<Site>;
  /** Presign S3 — JPEG/PNG/WebP ≤ 5 MB (POST /customer/uploads/presign). */
  presignCustomerUpload(body: {
    contentType: string;
    contentLength: number;
    filename?: string;
  }): Observable<CustomerUploadPresign>;
  requestSiteChange(siteId: string, actorId: string, note: string): Observable<AuditLog>;
  requestMonthlyPlan(siteId: string, actorId: string): Observable<AuditLog>;
  listAuditLogs(): Observable<AuditLog[]>;
  /** Cotação Melhor Envio (placa) — priceCents da API. */
  quoteShipping(destinationCep: string, quantity?: number): Observable<ShippingQuoteResult>;
  /** Direct Pronto checkout — amountCents comes from API only. */
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
  ): Observable<CheckoutResult>;
  /** Poll payment status from API/gateway — never trust redirect. */
  getPaymentStatus(gatewayPaymentId: string): Observable<PaymentStatusView>;
  listMyInvoices(): Observable<MyResellerInvoice[]>;
  getMyInvoice(id: string): Observable<MyResellerInvoice>;

  /** Revendedor — rotas /reseller/* (valores em centavos da API). */
  getResellerDashboard(): Observable<ResellerDashboardDto>;
  listResellerCustomers(cursor?: string | null): Observable<CursorPage<ResellerCustomerDto>>;
  createResellerCustomer(body: {
    name: string;
    doc?: string;
    whatsapp?: string;
    city?: string;
    email?: string;
  }): Observable<ResellerCustomerDto>;
  listResellerSites(cursor?: string | null): Observable<CursorPage<ResellerSiteDto>>;
  createResellerSite(body: {
    customerId: string;
    slug: string;
    templateId: string;
    planId: string;
    content?: Record<string, unknown>;
  }): Observable<ResellerSiteDto>;
  patchResellerSite(
    siteId: string,
    body: {
      templateId?: string;
      planId?: string;
      slug?: string;
      content?: Record<string, unknown>;
    },
  ): Observable<ResellerSiteDto>;
  publishResellerSite(siteId: string): Observable<ResellerSiteDto>;
  unpublishResellerSite(siteId: string): Observable<ResellerSiteDto>;
  /** Soft-archive (DELETE /reseller/sites/:id). */
  deleteResellerSite(siteId: string): Observable<ResellerSiteDto | { ok: true }>;
  checkResellerSlug(slug: string): Observable<SlugCheckDto>;
  listResellerSiteOptions(): Observable<SiteOptionsDto>;
  listResellerSales(cursor?: string | null): Observable<CursorPage<ResellerSaleDto>>;
  recordResellerSale(
    items: { productId: string; qty: number; unitPriceCents: number }[],
    idempotencyKey: string,
  ): Observable<ResellerSaleDto>;
  getResellerLedger(opts?: {
    from?: string;
    to?: string;
    cursor?: string | null;
  }): Observable<LedgerStatementDto>;
  getResellerLedgerBalance(): Observable<{ balanceCents: number }>;
  listResellerWholesale(): Observable<{ items: WholesaleItemDto[] }>;
  listResellerPrices(): Observable<{ items: ResellerPriceItemDto[] }>;
  listResellerPlaqueStock(): Observable<{ items: PlaqueStockItemDto[] }>;
  listResellerPlaqueMovements(cursor?: string | null): Observable<CursorPage<PlaqueMovementDto>>;
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
  ): Observable<PlaqueMovementDto>;

  /** Admin — B2 */
  getReseller(id: string): Observable<Reseller>;
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
  ): Observable<Reseller>;
  sendResellerPasswordReset(id: string): Observable<{ inviteActionLink: string | null }>;
  resetResellerMfa(id: string): Observable<{ removed: number }>;
  getResellerSummary(id: string): Observable<ResellerSummaryDto>;
  suspendResellerSites(id: string): Observable<{ count: number }>;
  impersonateReseller(id: string): Observable<ImpersonateResultDto>;
  /** Revendedor — GET/PATCH /reseller/me */
  getMyResellerProfile(): Observable<Reseller>;
  patchMyResellerProfile(body: {
    name?: string;
    document?: string;
    phone?: string;
    addressLine?: string;
    addressCity?: string;
    addressUf?: string;
    addressCep?: string;
  }): Observable<Reseller>;
  listAdminProducts(): Observable<AdminProductDto[]>;
  listResellerWholesaleAdmin(resellerId: string): Observable<ResellerWholesaleAdminDto>;
  setResellerWholesale(
    resellerId: string,
    body: SetWholesaleCommand,
  ): Observable<WholesalePriceRowDto>;
  getAdminPlaqueStock(resellerId: string): Observable<PlaqueStockRowDto[]>;
  listAdminPlaqueMovements(
    resellerId: string,
    cursor?: string | null,
  ): Observable<CursorPage<AdminPlaqueMovementDto>>;
  postAdminPlaqueMovement(
    body: AdminPlaqueMoveCommand,
    idempotencyKey: string,
  ): Observable<AdminPlaqueMovementDto>;
  transferPlaques(body: TransferPlaquesCommand, idempotencyKey: string): Observable<unknown>;
}

export interface CustomerOtp {
  delivered: boolean;
  previewCode: string | null;
}

export const API_PORT = new InjectionToken<ApiPort>('API_PORT');
