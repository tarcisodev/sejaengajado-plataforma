/** Shapes alinhados à Nest API (admin) — dinheiro em *Cents. */

export interface AdminProductDto {
  id: string;
  code: string;
  name: string;
  baseWholesaleCents: number;
}

export interface ResellerSummaryDto {
  id: string;
  name: string;
  status: string;
  sites: number;
  sales: number;
  stock: { plaque_type: string; qty: number }[];
}

export interface ImpersonateResultDto {
  mode: 'read';
  resellerId: string;
  name: string;
  status: string;
}

export interface WholesalePriceRowDto {
  id: string;
  productId: string;
  code: string;
  name: string;
  priceCents: number;
  validFrom: string;
  validTo: string | null;
}

export interface ResellerWholesaleAdminDto {
  resellerId: string;
  asOf: string;
  current: WholesalePriceRowDto[];
  history: WholesalePriceRowDto[];
}

export interface SetWholesaleCommand {
  productId: string;
  priceCents: number;
  validFrom: string;
  validTo?: string | null;
}

export interface PlaqueStockRowDto {
  plaqueType: string;
  qty: number;
  avgCostCents: number | null;
}

export interface PlaqueMovementDto {
  id: string;
  resellerId: string;
  type: string;
  plaqueType: string;
  qty: number;
  unitCostCents: number | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminPlaqueMoveCommand {
  resellerId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  plaqueType: 'QR' | 'NFC';
  qty: number;
  unitCostCents?: number;
  reason?: string;
}

export interface TransferPlaquesCommand {
  toResellerId: string;
  plaqueType: 'QR' | 'NFC';
  qty: number;
}
