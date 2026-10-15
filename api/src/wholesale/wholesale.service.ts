import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { asOfInSaoPaulo } from '../common/sao-paulo-time';
import { ADMIN_PRISMA, type AdminPrisma } from '../tenant/prisma.module';
import { PRISMA, type TenantPrisma } from '../tenant/prisma.module';

export const setWholesaleSchema = z.object({
  productId: z.string().uuid(),
  priceCents: z.number().int().positive(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional(),
});

export const resellerPriceSchema = z.object({
  productId: z.string().uuid(),
  priceCents: z.number().int().nonnegative(),
});

@Injectable()
export class WholesaleService {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly adminDb: AdminPrisma,
    @Inject(PRISMA) private readonly db: TenantPrisma,
  ) {}

  /** Admin-only: open a new validity window and close the open-ended prior row. */
  async setWholesale(resellerId: string, body: unknown) {
    const parsed = setWholesaleSchema.safeParse(body);
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

    const reseller = await this.adminDb.reseller.findUnique({ where: { id: resellerId } });
    if (!reseller) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Não encontrado' });
    }
    const product = await this.adminDb.product.findUnique({
      where: { id: parsed.data.productId },
    });
    if (!product) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'productId', code: 'not_found', message: 'Produto inválido' }],
      });
    }

    const validFrom = new Date(parsed.data.validFrom);
    const validTo = parsed.data.validTo ? new Date(parsed.data.validTo) : null;

    return this.adminDb.$transaction(async (tx) => {
      await tx.wholesalePrice.updateMany({
        where: {
          resellerId,
          productId: parsed.data.productId,
          validTo: null,
        },
        data: { validTo: validFrom },
      });
      return tx.wholesalePrice.create({
        data: {
          resellerId,
          productId: parsed.data.productId,
          priceCents: parsed.data.priceCents,
          validFrom,
          validTo,
        },
      });
    });
  }

  async resolvePriceCents(
    productId: string,
    at?: Date,
  ): Promise<{ priceCents: number; wholesalePriceId: string | null; source: 'override' | 'base' }> {
    const when = asOfInSaoPaulo(at);
    const override = await this.db.wholesalePrice.findFirst({
      where: {
        productId,
        validFrom: { lte: when },
        OR: [{ validTo: null }, { validTo: { gt: when } }],
      },
      orderBy: { validFrom: 'desc' },
    });
    if (override) {
      return {
        priceCents: override.priceCents,
        wholesalePriceId: override.id,
        source: 'override',
      };
    }
    const product = await this.db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Produto não encontrado' });
    }
    return {
      priceCents: product.baseWholesaleCents,
      wholesalePriceId: null,
      source: 'base',
    };
  }

  async listForCurrentReseller(at?: Date) {
    const when = asOfInSaoPaulo(at);
    const products = await this.db.product.findMany({ orderBy: { code: 'asc' } });
    const items = await Promise.all(
      products.map(async (product) => {
        const resolved = await this.resolvePriceCents(product.id, when);
        return {
          productId: product.id,
          code: product.code,
          name: product.name,
          baseWholesaleCents: product.baseWholesaleCents,
          priceCents: resolved.priceCents,
          wholesalePriceId: resolved.wholesalePriceId,
          source: resolved.source,
          asOf: when.toISOString(),
        };
      }),
    );
    return { items };
  }

  async listSuggestedPrices() {
    const rows = await this.db.resellerPrice.findMany({
      include: { product: true },
      orderBy: { product: { code: 'asc' } },
    });
    return {
      items: rows.map((row) => ({
        productId: row.productId,
        code: row.product.code,
        name: row.product.name,
        priceCents: row.priceCents,
      })),
    };
  }

  async upsertSuggestedPrice(resellerId: string, body: unknown) {
    const parsed = resellerPriceSchema.safeParse(body);
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
    const product = await this.db.product.findUnique({ where: { id: parsed.data.productId } });
    if (!product) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'productId', code: 'not_found', message: 'Produto inválido' }],
      });
    }
    const existing = await this.db.resellerPrice.findFirst({
      where: { productId: parsed.data.productId },
    });
    if (existing) {
      return this.db.resellerPrice.update({
        where: { id: existing.id },
        data: { priceCents: parsed.data.priceCents },
      });
    }
    return this.db.resellerPrice.create({
      data: {
        resellerId,
        productId: parsed.data.productId,
        priceCents: parsed.data.priceCents,
      },
    });
  }
}
