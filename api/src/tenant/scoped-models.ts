/**
 * Models that always carry resellerId (or nest under one) and must be
 * queried only through the tenant-scoped Prisma client.
 */
export const SCOPED_MODELS = [
  'Customer',
  'Site',
  'Plaque',
  'WholesalePrice',
  'ResellerPrice',
  'Sale',
  'SaleItem',
  'LedgerEntry',
  'PlaqueMovement',
  'ResellerInvoice',
  'InvoiceLine',
  'LifecycleEvent',
  'Order',
  'Payment',
  'Subscription',
  'ScanEvent',
  'User',
] as const;

export type ScopedModel = (typeof SCOPED_MODELS)[number];

export function isScopedModel(model: string): model is ScopedModel {
  return (SCOPED_MODELS as readonly string[]).includes(model);
}

/** Models whose resellerId lives on a parent relation. */
export const NESTED_SCOPED_MODELS: Partial<
  Record<ScopedModel, { relation: string }>
> = {
  SaleItem: { relation: 'sale' },
  InvoiceLine: { relation: 'invoice' },
  ScanEvent: { relation: 'site' },
};
