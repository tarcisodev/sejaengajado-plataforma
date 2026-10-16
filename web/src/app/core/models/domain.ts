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
  email?: string;
  document?: string;
  phone?: string;
  addressLine?: string;
  addressCity?: string;
  addressUf?: string;
  addressCep?: string;
  notes?: string;
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

export type SiteThemeVariant = 'simple' | 'f3' | 'f4' | 'f7';

export interface SiteTheme {
  /** Niche key for LU1+ tokens; legacy p1–hi still win when present. */
  niche?: 'barbearia' | 'restaurante' | 'moda' | 'beleza' | 'saude' | 'generico';
  brandColor?: string;
  p1: string;
  p2: string;
  p3: string;
  on3: string;
  hi: string;
  fontHeading: string;
  fontBody: string;
  /** Aliases FORMULA. */
  fonteTitulo?: string;
  fonteCorpo?: string;
  fontScale: number;
  escalaTitulo?: number;
  italic: 'normal' | 'italic';
  italico?: 'normal' | 'italic';
  bgImg?: string;
  bgIntensidade?: number;
  variante?: SiteThemeVariant;
}

export interface SiteWhatsapp {
  numero: string;
  mensagem: string;
  /** Prefixo do pedido no carrinho / FAB. */
  mensagemPadrao?: string;
  introPedido?: string;
}

export type SiteLinkTipo = SiteLinkType | 'agenda' | 'youtube' | 'facebook' | 'tiktok' | 'outro';

export interface SiteLink {
  tipo: SiteLinkTipo;
  titulo: string;
  subtitulo?: string;
  url: string;
  icone?: string;
  destaque?: boolean;
  badge?: string;
  aoVivo?: boolean;
}

export interface SiteHours {
  dias: string;
  abre?: string;
  fecha?: string;
  fechado?: boolean;
}

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  open: string;
  close: string;
}

/** Structured weekly hours for "Aberto agora" (LU5). */
export type SiteWeeklyHours = Partial<Record<WeekdayKey, DayHours | null>>;

export interface SiteFaqItem {
  question: string;
  answer: string;
}

export interface SiteProduct {
  nome: string;
  precoTexto: string;
  rotuloBotao?: string;
  tag?: string;
  fotoUrl?: string;
  categoria?: string;
}

export interface SiteService {
  nome: string;
  fotoUrl?: string;
}

export interface SitePromo {
  titulo: string;
  texto: string;
  item?: string;
  precoTexto?: string;
  terminaEm: string;
  cta?: string;
}

export interface SiteGoogle {
  placeId: string;
  /** Null/undefined → UI shows "—" (placeholder, never invent a score). */
  rating?: number | null;
  reviewCount?: number | null;
  /** Aliases FORMULA (nota/total). */
  nota?: number | null;
  total?: number | null;
}

export interface SiteAddress {
  logradouro: string;
  cidade: string;
  uf: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

export interface SiteVideo {
  youtubeId: string;
  titulo?: string;
}

export interface SiteSocial {
  tipo: string;
  url: string;
}

export interface SiteAnalytics {
  gaId?: string;
  metaPixel?: string;
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

export type StripMotif =
  'pizza' | 'tesoura' | 'circulos' | 'estrelas' | 'agulha' | 'coracao' | 'none';

export interface SiteStrip {
  enabled: boolean;
  motif: StripMotif;
  speed?: 'slow' | 'normal' | 'fast' | number;
  direction?: 'left' | 'right';
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
  /** Modo do carrossel de produtos (FORMULA). */
  produtosModo?: 'unica' | 'auto';
  servicos?: SiteService[];
  promo?: SitePromo;
  google?: SiteGoogle;
  address?: SiteAddress;
  mapsUrl?: string;
  phone?: string;
  telefone?: string;
  pix?: SitePix;
  video?: SiteVideo;
  redes?: SiteSocial[];
  analytics?: SiteAnalytics;
  seo?: SiteSeo;
  /** Optional decorative motif strip (LU3). */
  strip?: SiteStrip;
  timezone?: string;
  weeklyHours?: SiteWeeklyHours;
  faq?: SiteFaqItem[];
}

export interface Site {
  id: string;
  customerId: string;
  resellerId: string | null;
  slug: string;
  customDomain: string | null;
  templateId: string;
  /** From public by-host (template.schemaType) — no auth needed on tenant SSR. */
  schemaType?: string;
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

/** Melhor Envio quote option — priceCents from API only. */
export interface ShippingQuoteOption {
  serviceId: string;
  name: string;
  company: string;
  priceCents: number;
  deliveryDays: number;
}

export interface ShippingQuoteResult {
  originCep: string;
  options: ShippingQuoteOption[];
}

/** Checkout response from API — amounts in centavos only. */
export interface CheckoutResult {
  orderId: string;
  paymentId: string;
  gatewayPaymentId: string;
  amountCents: number;
  /** Frete Melhor Envio incluído no total (0 se sem envio). */
  shippingCents?: number;
  shippingServiceId?: string | null;
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
