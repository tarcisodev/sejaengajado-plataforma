import type { AdminPrisma } from '../tenant/prisma.module';
import { asOfInSaoPaulo } from '../common/sao-paulo-time';

/** Resolve wholesale cents for a reseller+product without tenant ALS. */
export async function resolveWholesaleCentsAdmin(
  db: AdminPrisma,
  resellerId: string,
  productId: string,
  at?: Date,
): Promise<number> {
  const when = asOfInSaoPaulo(at);
  const override = await db.wholesalePrice.findFirst({
    where: {
      resellerId,
      productId,
      validFrom: { lte: when },
      OR: [{ validTo: null }, { validTo: { gt: when } }],
    },
    orderBy: { validFrom: 'desc' },
  });
  if (override) {
    return override.priceCents;
  }
  const product = await db.product.findUnique({ where: { id: productId } });
  return product?.baseWholesaleCents ?? 0;
}
