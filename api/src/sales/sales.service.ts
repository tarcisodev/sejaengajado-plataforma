import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductCode, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../common/cursor';
import { LedgerService } from '../ledger/ledger.service';
import { assertResellerOperable } from '../reseller/reseller-status';
import { StockService } from '../stock/stock.service';
import {
  APP_PRISMA,
  PRISMA,
  type AppPrisma,
  type TenantPrisma,
} from '../tenant/prisma.module';
import { requireTenantResellerId } from '../tenant/tenant.context';
import { WholesaleService } from '../wholesale/wholesale.service';

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const recordSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
});

function plaqueTypeOf(code: ProductCode): 'QR' | 'NFC' | null {
  if (code === 'PLAQUE_QR') {
    return 'QR';
  }
  if (code === 'PLAQUE_NFC') {
    return 'NFC';
  }
  return null;
}

export function predictedMarginCents(
  items: { qty: number; unitPriceCents: number; unitCostCents: number }[],
): number {
  return items.reduce(
    (sum, item) => sum + item.qty * (item.unitPriceCents - item.unitCostCents),
    0,
  );
}

function bodyFingerprint(
  items: { productId: string; qty: number; unitPriceCents: number }[],
): string {
  const normalized = [...items]
    .map((item) => ({
      productId: item.productId,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(PRISMA) private readonly db: TenantPrisma,
    @Inject(APP_PRISMA) private readonly appDb: AppPrisma,
    private readonly wholesale: WholesaleService,
    private readonly ledger: LedgerService,
    private readonly stock: StockService,
  ) {}

  private async requireOperable() {
    const resellerId = requireTenantResellerId();
    const reseller = await this.db.reseller.findUnique({
      where: { id: resellerId },
      select: { status: true },
    });
    if (!reseller) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Não encontrado' });
    }
    assertResellerOperable(reseller.status);
    return resellerId;
  }

  private present<T extends { items: { qty: number; unitPriceCents: number; unitCostCents: number }[] }>(
    sale: T,
  ) {
    return {
      ...sale,
      predictedMarginCents: predictedMarginCents(sale.items),
    };
  }

  async list(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.sale.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : undefined,
      include: { items: { include: { product: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = paginate(rows, limit, (row) =>
      encodeTimeIdCursor(row.createdAt, row.id),
    );
    return {
      items: page.items.map((sale) => this.present(sale)),
      nextCursor: page.nextCursor,
    };
  }

  async get(id: string) {
    const sale = await this.db.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!sale) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
    }
    return this.present(sale);
  }

  async record(body: unknown, idempotencyKey: string | undefined) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [
          {
            path: 'Idempotency-Key',
            code: 'required',
            message: 'Idempotency-Key obrigatória',
          },
        ],
      });
    }

    const parsed = recordSaleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      });
    }

    const resellerId = await this.requireOperable();
    const fingerprint = bodyFingerprint(parsed.data.items);

    const existing = await this.db.sale.findFirst({
      where: { idempotencyKey },
      include: { items: { include: { product: true } } },
    });
    if (existing) {
      const existingFp = bodyFingerprint(
        existing.items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
        })),
      );
      if (existingFp !== fingerprint) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency-Key já usada com outro corpo',
        });
      }
      return this.present(existing);
    }

    const resolvedItems = await Promise.all(
      parsed.data.items.map(async (item) => {
        const product = await this.db.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new BadRequestException({
            code: 'VALIDATION_FAILED',
            message: 'Dados inválidos',
            fields: [
              { path: 'items.productId', code: 'not_found', message: 'Produto inválido' },
            ],
          });
        }
        const wholesale = await this.wholesale.resolvePriceCents(product.id);
        return {
          product,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
          unitCostCents: wholesale.priceCents,
          wholesalePriceId: wholesale.wholesalePriceId,
        };
      }),
    );

    try {
      const sale = await this.appDb.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.reseller_id', ${resellerId}, true)`;

        const created = await tx.sale.create({
          data: {
            resellerId,
            status: 'RECORDED',
            idempotencyKey,
          },
        });

        for (const item of resolvedItems) {
          await tx.saleItem.create({
            data: {
              saleId: created.id,
              productId: item.product.id,
              qty: item.qty,
              unitCostCents: item.unitCostCents,
              unitPriceCents: item.unitPriceCents,
              wholesalePriceId: item.wholesalePriceId,
            },
          });
        }

        const withItems = await tx.sale.findUniqueOrThrow({
          where: { id: created.id },
          include: { items: { include: { product: true } } },
        });

        const totalPrice = withItems.items.reduce(
          (sum, item) => sum + item.qty * item.unitPriceCents,
          0,
        );
        if (totalPrice > 0) {
          await this.ledger.append(
            {
              type: 'IN',
              category: 'SALE',
              amountCents: totalPrice,
              refType: 'Sale',
              refId: withItems.id,
            },
            tx as unknown as { ledgerEntry: PrismaClient['ledgerEntry'] },
          );
        }

        for (const item of withItems.items) {
          const plaqueType = plaqueTypeOf(item.product.code);
          if (!plaqueType) {
            continue;
          }
          await this.stock.moveInTx(tx as unknown as Parameters<StockService['moveInTx']>[0], {
            resellerId,
            type: 'OUT',
            plaqueType,
            qty: item.qty,
            reason: 'SALE',
            saleItemId: item.id,
            unitCostCents: item.unitCostCents,
          });
        }

        return withItems;
      });
      return this.present(sale);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        const raced = await this.db.sale.findFirst({
          where: { idempotencyKey },
          include: { items: { include: { product: true } } },
        });
        if (raced) {
          const racedFp = bodyFingerprint(
            raced.items.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              unitPriceCents: item.unitPriceCents,
            })),
          );
          if (racedFp !== fingerprint) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'Idempotency-Key já usada com outro corpo',
            });
          }
          return this.present(raced);
        }
      }
      throw error;
    }
  }

  async void(id: string) {
    const resellerId = await this.requireOperable();
    const sale = await this.db.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!sale) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
    }
    if (sale.status === 'VOIDED') {
      throw new ConflictException({
        code: 'ALREADY_VOIDED',
        message: 'Venda já anulada',
      });
    }

    const voided = await this.appDb.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.reseller_id', ${resellerId}, true)`;

      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'VOIDED' },
        include: { items: { include: { product: true } } },
      });

      const ledgerIn = await tx.ledgerEntry.findFirst({
        where: {
          resellerId,
          refType: 'Sale',
          refId: sale.id,
          category: 'SALE',
          type: 'IN',
        },
      });
      if (ledgerIn) {
        await this.ledger.reverse(
          ledgerIn.id,
          tx as unknown as { ledgerEntry: PrismaClient['ledgerEntry'] },
        );
      }

      for (const item of sale.items) {
        const plaqueType = plaqueTypeOf(item.product.code);
        if (!plaqueType) {
          continue;
        }
        await this.stock.moveInTx(tx as unknown as Parameters<StockService['moveInTx']>[0], {
          resellerId,
          type: 'IN',
          plaqueType,
          qty: item.qty,
          reason: 'SALE_VOID',
          saleItemId: item.id,
          unitCostCents: item.unitCostCents,
        });
      }

      return updated;
    });

    return this.present(voided);
  }
}
