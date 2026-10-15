import { getHarnessPostgres } from './postgres';

const TABLES = [
  'invoice_lines',
  'reseller_invoices',
  'lifecycle_events',
  'plaque_movements',
  'ledger_entries',
  'sale_items',
  'sales',
  'reseller_prices',
  'wholesale_prices',
  'scan_events',
  'plaques',
  'payments',
  'orders',
  'subscriptions',
  'sites',
  'customers',
  'users',
  'resellers',
  'reseller_plans',
  'products',
  'templates',
  'plans',
  'coupons',
  'webhook_events',
  'reserved_slugs',
  'platform_config',
  'audit_logs',
] as const;

export async function truncateAll(): Promise<void> {
  const { adminUrl } = getHarnessPostgres();
  const { PrismaClient } = await import('@prisma/client');
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$executeRawUnsafe(
      `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  } finally {
    await admin.$disconnect();
  }
}
