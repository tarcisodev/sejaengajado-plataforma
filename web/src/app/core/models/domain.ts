export type UserRole = 'ADMIN' | 'RESELLER' | 'CUSTOMER';

export type ResellerStatus = 'ACTIVE' | 'DELINQUENT' | 'BLOCKED';

export type SiteStatus = 'DRAFT' | 'PUBLISHED' | 'READ_ONLY' | 'SUSPENDED' | 'ARCHIVED';

export type PlanType = 'ONE_TIME' | 'RECURRING' | 'ANNUAL_HOSTING';

export type CouponType = 'PCT' | 'FIXED';

export type PaymentMethod = 'PIX' | 'CARD' | 'BOLETO';

export type PlaqueType = 'QR' | 'NFC';

export type PlaqueStatus = 'ESTOQUE' | 'ENTREGUE';

export interface User {
  id: string;
  supabaseId: string;
  email: string;
  role: UserRole;
}

export interface Reseller {
  id: string;
  userId: string;
  nome: string;
  resellerPlanId: string;
  status: ResellerStatus;
  delinquentSince: string | null;
  blockedAt: string | null;
  blockReason: string | null;
  asaasWalletId: string | null;
}

export interface ResellerPlan {
  id: string;
  nome: string;
  mensalidadeCentavos: number;
  custoPorSiteAtivoCentavos: number;
  limiteSites: number | null;
}

export interface ResellerPrice {
  resellerId: string;
  planId: string;
  precoCentavos: number;
}

export interface ResellerGoal {
  resellerId: string;
  mes: string;
  metaSites: number;
  metaReceita: number;
}

export interface PlaqueStock {
  resellerId: string;
  tipo: PlaqueType;
  qtd: number;
  custoMedio: number;
}

export interface Customer {
  id: string;
  userId: string | null;
  resellerId: string | null;
  nome: string;
  doc: string;
  whatsapp: string;
  cidade: string;
}

export type SchemaType = 'HairSalon' | 'Restaurant' | 'ProfessionalService' | 'LocalBusiness';

export type SiteLinkType = 'whatsapp' | 'instagram' | 'maps' | 'tel' | 'url';

export interface SiteProfile {
  nome: string;
  slogan?: string;
  logoUrl?: string;
  tags?: string[];
  cidade: string;
  uf: string;
}

export interface SiteTheme {
  p1: string;
  p2: string;
  p3: string;
  on3: string;
  hi: string;
  fontHeading: string;
  fontBody: string;
  fontScale: number;
  italic: 'normal' | 'italic';
}

export interface SiteWhatsapp {
  numero: string;
  mensagem: string;
}

export interface SiteLink {
  tipo: SiteLinkType;
  titulo: string;
  url: string;
}

export interface SiteHours {
  dias: string;
  abre?: string;
  fecha?: string;
  fechado?: boolean;
}

export interface SiteProduct {
  nome: string;
  precoTexto: string;
  fotoUrl?: string;
}

export interface SitePromo {
  titulo: string;
  texto: string;
  terminaEm: string;
}

export interface SiteGoogle {
  placeId: string;
}

export interface SiteAddress {
  logradouro: string;
  cidade: string;
  uf: string;
  cep?: string;
}

export interface SitePix {
  chave: string;
  nome: string;
  qrUrl?: string;
}

export interface SiteSeo {
  title?: string;
  description?: string;
  about?: string;
  ogImageUrl?: string;
}

export interface SiteContent {
  businessName: string;
  profile: SiteProfile;
  theme: SiteTheme;
  whatsapp?: SiteWhatsapp;
  links?: SiteLink[];
  hours?: SiteHours[];
  gallery?: string[];
  products?: SiteProduct[];
  promo?: SitePromo;
  google?: SiteGoogle;
  address?: SiteAddress;
  phone?: string;
  pix?: SitePix;
  seo?: SiteSeo;
}

export interface Site {
  id: string;
  customerId: string;
  resellerId: string | null;
  slug: string;
  customDomain: string | null;
  templateId: string;
  content: SiteContent;
  status: SiteStatus;
  planId: string;
  editable: boolean;
  publishedAt: string | null;
  hostingRenewsAt: string | null;
  plaqueFidelityEndsAt: string | null;
}

export interface Template {
  id: string;
  key: string;
  nome: string;
  ramo: string;
  schemaType: SchemaType;
  schema: Record<string, unknown>;
  ativo: boolean;
}

export interface Plan {
  id: string;
  code: string;
  nome: string;
  tipo: PlanType;
  precoCentavos: number;
  intervalo: string | null;
  features: Record<string, unknown>;
}

export interface PlatformConfig {
  notifyFromDias: number;
  readOnlyDias: number;
  suspendDias: number;
  archiveDias: number;
  prontoRenewalCentavos: number;
  plaqueValueCentavos: number;
  plaquePenaltyPct: number;
  resellerGraceDays: number;
}

export interface Coupon {
  id: string;
  code: string;
  tipo: CouponType;
  valor: number;
  validade: string;
  maxUsos: number;
  usos: number;
  planIds: string[];
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELED';

export interface Order {
  id: string;
  customerId: string;
  resellerId: string | null;
  siteId: string;
  planId: string;
  couponId: string | null;
  valorBruto: number;
  desconto: number;
  valorLiquido: number;
  status: OrderStatus;
}

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface Subscription {
  id: string;
  siteId: string | null;
  resellerId: string | null;
  gateway: string;
  gatewaySubId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

/** Gateway/API payment status for polling (never derive from redirect). */
export type GatewayPaymentStatus =
  'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'REFUNDED' | 'FAILED' | 'CANCELLED' | string;

export interface Payment {
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  resellerId: string | null;
  gateway: string;
  gatewayPaymentId: string;
  metodo: PaymentMethod;
  /** Centavos — only display via formatBrl; never recalculate. */
  valor: number;
  status: PaymentStatus;
  paidAt: string | null;
}

/** Checkout response from API — amounts in centavos only. */
export interface CheckoutResult {
  orderId: string;
  paymentId: string;
  gatewayPaymentId: string;
  amountCents: number;
  method: PaymentMethod;
  status: GatewayPaymentStatus;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  /** Hosted Asaas invoice (card checkout) — open this URL; never collect card data. */
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

export interface PaymentStatusView {
  gatewayPaymentId: string;
  status: GatewayPaymentStatus;
  amountCents: number;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID';

/** Reseller "Minhas faturas" row — totals from API centavos. */
export interface MyResellerInvoice {
  id: string;
  period: string;
  status: InvoiceStatus;
  totalCents: number;
  dueDate: string | null;
  gatewayPaymentId: string | null;
  paymentStatus: GatewayPaymentStatus | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixCopyPaste: string | null;
  lines: {
    description: string;
    qty: number;
    unitCents: number;
    totalCents: number;
  }[];
}

export interface WebhookEvent {
  id: string;
  gateway: string;
  eventId: string;
  payload: Record<string, unknown>;
  processedAt: string | null;
}

export interface Plaque {
  id: string;
  siteId: string | null;
  tipo: PlaqueType;
  codigo: string;
  status: PlaqueStatus;
  valorCentavos: number | null;
  giftedBool: boolean;
}

export interface ScanEvent {
  id: string;
  siteId: string;
  ts: string;
  ipHash: string;
}

export interface Cancellation {
  id: string;
  siteId: string;
  subscriptionId: string;
  plaqueValueCentavos: number;
  plaquePenaltyPct: number;
  diasRestantes: number;
  mesesRestantes: number;
  multaCentavos: number;
  orderId: string;
  createdAt: string;
}

export interface ResellerInvoice {
  id: string;
  resellerId: string;
  mes: string;
  closedAt: string;
  mensalidadeCentavos: number;
  custoPorSiteAtivoCentavos: number;
  activeSiteIds: string[];
  totalCentavos: number;
}

export interface NoticeLog {
  entityType: string;
  entityId: string;
  kind: string;
  localDate: string;
}

export interface ReservedSlug {
  slug: string;
}

export interface AuditLog {
  actor: string;
  acao: string;
  entidade: string;
  diff: Record<string, unknown>;
}
