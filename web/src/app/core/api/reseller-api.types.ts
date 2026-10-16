/** Shapes alinhados à Nest API (dinheiro em *Cents). */

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string | null;
}

export interface ResellerDashboardDto {
  activeSites: number;
  monthSalesCents: number;
  predictedMarginCents: number;
  realizedMarginCents: number;
  balanceCents: number;
  stock: { plaqueType: string; qty: number }[];
  openInvoice: {
    id: string;
    period: string;
    totalCents: number;
    status: string;
    lines?: {
      description: string;
      qty: number;
      unitCents: number;
      totalCents: number;
    }[];
  } | null;
  monthFrom: string;
  monthToExclusive: string;
}

export interface ResellerCustomerDto {
  id: string;
  resellerId: string;
  name: string;
  doc: string;
  whatsapp: string;
  city: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResellerSiteDto {
  id: string;
  resellerId: string;
  customerId: string;
  slug: string;
  templateId: string;
  planId: string;
  status: string;
  editable: boolean;
  content: unknown;
  publishedAt: string | null;
  hostingRenewsAt: string | null;
  plaqueFidelityEndsAt: string | null;
  customer?: { id: string; name: string };
  plan?: { id: string; code: string; name: string; priceCents: number };
  template?: { id: string; key: string; name: string };
}

export interface ResellerSaleDto {
  id: string;
  resellerId: string;
  createdAt: string;
  voidedAt?: string | null;
  predictedMarginCents?: number;
  items?: {
    productId: string;
    qty: number;
    unitCostCents: number;
    unitPriceCents: number;
  }[];
}

export interface LedgerEntryDto {
  id: string;
  resellerId: string;
  type: 'IN' | 'OUT';
  category: string;
  amountCents: number;
  refType: string | null;
  refId: string | null;
  reversalOfId: string | null;
  createdAt: string;
}

export interface LedgerStatementDto {
  items: LedgerEntryDto[];
  nextCursor?: string | null;
  openingCents: number;
  closingCents: number;
}

export interface SiteOptionsDto {
  plans: { id: string; code: string; name: string; type: string; priceCents: number }[];
  templates: { id: string; key: string; name: string; niche: string }[];
}

export interface WholesaleItemDto {
  productId: string;
  code: string;
  name: string;
  baseWholesaleCents: number;
  priceCents: number;
  wholesalePriceId?: string | null;
  source?: string;
  asOf?: string;
}

export interface ResellerPriceItemDto {
  productId: string;
  code: string;
  name: string;
  priceCents: number;
}

export interface SlugCheckDto {
  slug: string;
  available: boolean;
  code?: string;
}

export interface PlaqueStockItemDto {
  plaqueType: string;
  qty: number;
  avgCostCents: number | null;
}

export interface PlaqueMovementDto {
  id: string;
  resellerId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  plaqueType: string;
  qty: number;
  unitCostCents: number | null;
  siteId: string | null;
  reason: string | null;
  createdAt: string;
}
