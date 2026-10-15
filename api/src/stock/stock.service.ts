import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlaqueType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../common/cursor';
import { roundCents } from '../common/money';
import { asOfInSaoPaulo } from '../common/sao-paulo-time';
import { LedgerService } from '../ledger/ledger.service';
import {
  ADMIN_PRISMA,
  PRISMA,
  type AdminPrisma,
  type TenantPrisma,
} from '../tenant/prisma.module';
import { requireTenantResellerId } from '../tenant/tenant.context';

const PRO_PLAN_CODES = new Set(['ENGAJADO_PRO', 'SITE_PRO']);

export const adminMovementSchema = z.object({
  resellerId: z.string().uuid(),
  type: z.enum(['IN', 'ADJUST']),
  plaqueType: z.enum(['QR', 'NFC']),
  qty: z.number().int().positive(),
  unitCostCents: z.number().int().nonnegative().optional(),
  reason: z.string().min(1).optional(),
});

export const transferSchema = z.object({
  toResellerId: z.string().uuid(),
  plaqueType: z.enum(['QR', 'NFC']),
  qty: z.number().int().positive(),
});

export const resellerMovementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('IN'),
    plaqueType: z.enum(['QR', 'NFC']),
    qty: z.number().int().positive(),
    unitCostCents: z.number().int().nonnegative().optional(),
    reason: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('OUT'),
    plaqueType: z.enum(['QR', 'NFC']),
    qty: z.number().int().positive(),
    reason: z.literal('GIFT'),
    siteId: z.string().uuid(),
  }),
]);

type Tx = {
  $executeRaw: AdminPrisma['$executeRaw'];
  $queryRaw: AdminPrisma['$queryRaw'];
  plaqueMovement: AdminPrisma['plaqueMovement'];
  reseller: AdminPrisma['reseller'];
  site: AdminPrisma['site'];
  product: AdminPrisma['product'];
  wholesalePrice: AdminPrisma['wholesalePrice'];
  ledgerEntry: AdminPrisma['ledgerEntry'];
};

function stockInsufficient(): ConflictException {
  return new ConflictException({
    code: 'STOCK_INSUFFICIENT',
    message: 'Estoque insuficiente',
  });
}

@Injectable()
export class StockService {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly adminDb: AdminPrisma,
    @Inject(PRISMA) private readonly db: TenantPrisma,
    private readonly ledger: LedgerService,
  ) {}

  async listStock(resellerId: string) {
    return this.mapStockRows(
      await this.adminDb.$queryRaw<
        { plaque_type: PlaqueType; qty: number; avg_cost_cents: number | null }[]
      >(this.stockQuery(resellerId)),
    );
  }

  async listStockForCurrent() {
    const resellerId = requireTenantResellerId();
    const rows = await this.db.$transaction(async (tx) =>
      tx.$queryRaw<
        { plaque_type: PlaqueType; qty: number; avg_cost_cents: number | null }[]
      >(this.stockQuery(resellerId)),
    );
    return this.mapStockRows(rows);
  }

  private stockQuery(resellerId: string) {
    return Prisma.sql`
      SELECT
        ps.plaque_type,
        ps.qty,
        CASE
          WHEN COALESCE(c.qty_costed, 0) = 0 THEN NULL
          ELSE ROUND(c.value_cents::numeric / c.qty_costed)::integer
        END AS avg_cost_cents
      FROM plaque_stock ps
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(qty), 0)::integer AS qty_costed,
          COALESCE(SUM(qty * unit_cost_cents), 0)::bigint AS value_cents
        FROM plaque_movements pm
        WHERE pm.reseller_id = ps.reseller_id
          AND pm.plaque_type = ps.plaque_type
          AND pm.type IN ('IN', 'ADJUST')
          AND pm.unit_cost_cents IS NOT NULL
      ) c ON true
      WHERE ps.reseller_id = ${resellerId}::uuid
      ORDER BY ps.plaque_type
    `;
  }

  private mapStockRows(
    rows: { plaque_type: PlaqueType; qty: number; avg_cost_cents: number | null }[],
  ) {
    return {
      items: rows.map((row) => ({
        plaqueType: row.plaque_type,
        qty: row.qty,
        avgCostCents: row.avg_cost_cents,
      })),
    };
  }

  async listMovements(
    resellerId: string,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.adminDb.plaqueMovement.findMany({
      where: {
        resellerId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }

  async listMovementsForCurrent(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.plaqueMovement.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }

  async adminMove(body: unknown, idempotencyKey?: string) {
    const parsed = adminMovementSchema.safeParse(body);
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
    if (parsed.data.type === 'ADJUST' && !parsed.data.reason && !idempotencyKey) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'reason', code: 'required', message: 'Motivo obrigatório' }],
      });
    }
    const reseller = await this.adminDb.reseller.findUnique({
      where: { id: parsed.data.resellerId },
    });
    if (!reseller) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Não encontrado' });
    }

    return this.adminDb.$transaction(async (tx) =>
      this.moveInTx(tx as unknown as Tx, {
        resellerId: parsed.data.resellerId,
        type: parsed.data.type,
        plaqueType: parsed.data.plaqueType,
        qty: parsed.data.qty,
        unitCostCents: parsed.data.unitCostCents,
        reason: this.mergeReason(parsed.data.reason, idempotencyKey),
        idempotencyKey,
      }),
    );
  }

  async resellerMove(body: unknown, idempotencyKey?: string) {
    const parsed = resellerMovementSchema.safeParse(body);
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
    const resellerId = requireTenantResellerId();

    if (parsed.data.type === 'OUT') {
      return this.gift({
        siteId: parsed.data.siteId,
        plaqueType: parsed.data.plaqueType,
        qty: parsed.data.qty,
        idempotencyKey,
      });
    }

    const inbound = parsed.data;
    return this.db.$transaction(async (tx) =>
      this.moveInTx(tx as unknown as Tx, {
        resellerId,
        type: 'IN',
        plaqueType: inbound.plaqueType,
        qty: inbound.qty,
        unitCostCents: inbound.unitCostCents,
        reason: this.mergeReason(inbound.reason ?? 'third_party', idempotencyKey),
        idempotencyKey,
      }),
    );
  }

  async gift(input: {
    siteId: string;
    plaqueType: 'QR' | 'NFC';
    qty: number;
    idempotencyKey?: string;
  }) {
    const resellerId = requireTenantResellerId();
    const site = await this.db.site.findUnique({
      where: { id: input.siteId },
      include: { plan: true },
    });
    if (!site) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Site não encontrado' });
    }
    if (!PRO_PLAN_CODES.has(site.plan.code)) {
      throw new ForbiddenException({
        code: 'GIFT_PRO_ONLY',
        message: 'Brinde de placa só é permitido em site Engajado Pro',
      });
    }

    return this.db.$transaction(async (tx) =>
      this.moveInTx(tx as unknown as Tx, {
        resellerId,
        type: 'OUT',
        plaqueType: input.plaqueType,
        qty: input.qty,
        reason: this.mergeReason('GIFT', input.idempotencyKey),
        siteId: input.siteId,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  async transfer(body: unknown, idempotencyKey?: string) {
    const parsed = transferSchema.safeParse(body);
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

    const platform = await this.adminDb.reseller.findFirst({
      where: { isPlatform: true },
    });
    if (!platform) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Revendedor plataforma não encontrado',
      });
    }
    const to = await this.adminDb.reseller.findUnique({
      where: { id: parsed.data.toResellerId },
    });
    if (!to || to.isPlatform) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Revendedor inválido' });
    }

    if (idempotencyKey) {
      const existing = await this.adminDb.plaqueMovement.findFirst({
        where: {
          resellerId: to.id,
          type: 'IN',
          reason: this.mergeReason('TRANSFER', idempotencyKey),
        },
      });
      if (existing) {
        return {
          platformOutId: null as string | null,
          resellerIn: existing,
          ledgerEntryId: null as string | null,
          reused: true,
        };
      }
    }

    const unitCostCents = await this.resolvePlaqueWholesaleCents(
      to.id,
      parsed.data.plaqueType,
    );
    const totalCents = unitCostCents * parsed.data.qty;

    return this.adminDb.$transaction(async (tx) => {
      const platformOut = await this.moveInTx(tx as unknown as Tx, {
        resellerId: platform.id,
        type: 'OUT',
        plaqueType: parsed.data.plaqueType,
        qty: parsed.data.qty,
        reason: this.mergeReason('TRANSFER', idempotencyKey),
        unitCostCents,
      });

      const resellerIn = await this.moveInTx(tx as unknown as Tx, {
        resellerId: to.id,
        type: 'IN',
        plaqueType: parsed.data.plaqueType,
        qty: parsed.data.qty,
        reason: this.mergeReason('TRANSFER', idempotencyKey),
        unitCostCents,
      });

      let ledgerEntryId: string | null = null;
      if (totalCents > 0) {
        const ledger = await this.ledger.appendForReseller(
          to.id,
          {
            type: 'OUT',
            category: 'PLAQUE_PURCHASE',
            amountCents: totalCents,
            refType: 'PlaqueMovement',
            refId: resellerIn.id,
          },
          tx,
        );
        ledgerEntryId = ledger.id;
      }

      return {
        platformOutId: platformOut.id,
        resellerIn,
        ledgerEntryId,
        reused: false,
      };
    });
  }

  /**
   * Core stock mutation: advisory lock → saldo pela view → INSERT (append-only).
   * Never UPDATEs a balance row.
   */
  async moveInTx(
    tx: Tx,
    input: {
      resellerId: string;
      type: 'IN' | 'OUT' | 'ADJUST';
      plaqueType: 'QR' | 'NFC';
      qty: number;
      unitCostCents?: number;
      reason?: string | null;
      siteId?: string;
      saleItemId?: string;
      idempotencyKey?: string;
    },
  ) {
    if (input.idempotencyKey && input.reason) {
      const existing = await tx.plaqueMovement.findFirst({
        where: {
          resellerId: input.resellerId,
          reason: input.reason,
        },
      });
      if (existing) {
        return existing;
      }
    }

    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${input.resellerId}),
        hashtext(${input.plaqueType})
      )
    `;

    const qty = await this.qtyInTx(tx, input.resellerId, input.plaqueType);
    if (input.type === 'OUT' && qty < input.qty) {
      throw stockInsufficient();
    }

    let unitCostCents = input.unitCostCents ?? null;
    if (input.type === 'OUT' && unitCostCents === null) {
      unitCostCents = await this.avgCostInTx(tx, input.resellerId, input.plaqueType);
    }

    return tx.plaqueMovement.create({
      data: {
        resellerId: input.resellerId,
        type: input.type,
        plaqueType: input.plaqueType,
        qty: input.qty,
        unitCostCents,
        reason: input.reason ?? null,
        siteId: input.siteId ?? null,
        saleItemId: input.saleItemId ?? null,
      },
    });
  }

  /** Public helper for sales (B12): OUT under tenant scope + lock. */
  async moveOut(input: {
    plaqueType: 'QR' | 'NFC';
    qty: number;
    siteId?: string;
    saleItemId?: string;
    reason?: string;
  }) {
    const resellerId = requireTenantResellerId();
    return this.db.$transaction(async (tx) =>
      this.moveInTx(tx as unknown as Tx, {
        resellerId,
        type: 'OUT',
        plaqueType: input.plaqueType,
        qty: input.qty,
        siteId: input.siteId,
        saleItemId: input.saleItemId,
        reason: input.reason ?? 'SALE',
      }),
    );
  }

  private mergeReason(reason: string | undefined, idempotencyKey?: string): string | null {
    if (idempotencyKey) {
      const base = reason ?? 'move';
      return `${base}|idemp:${idempotencyKey}`;
    }
    return reason ?? null;
  }

  private async qtyInTx(
    tx: Tx,
    resellerId: string,
    plaqueType: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ qty: number }[]>`
      SELECT qty FROM plaque_stock
      WHERE reseller_id = ${resellerId}::uuid
        AND plaque_type = ${plaqueType}::"PlaqueType"
    `;
    return rows[0]?.qty ?? 0;
  }

  private async avgCostInTx(
    tx: Tx,
    resellerId: string,
    plaqueType: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ avg: number | null }[]>`
      SELECT CASE
        WHEN COALESCE(SUM(qty), 0) = 0 THEN NULL
        ELSE ROUND(SUM(qty * unit_cost_cents)::numeric / SUM(qty))::integer
      END AS avg
      FROM plaque_movements
      WHERE reseller_id = ${resellerId}::uuid
        AND plaque_type = ${plaqueType}::"PlaqueType"
        AND type IN ('IN', 'ADJUST')
        AND unit_cost_cents IS NOT NULL
    `;
    return rows[0]?.avg ?? 0;
  }

  private async resolvePlaqueWholesaleCents(
    resellerId: string,
    plaqueType: 'QR' | 'NFC',
  ): Promise<number> {
    const code = plaqueType === 'QR' ? 'PLAQUE_QR' : 'PLAQUE_NFC';
    const product = await this.adminDb.product.findUnique({ where: { code } });
    if (!product) {
      return 0;
    }
    const when = asOfInSaoPaulo();
    const override = await this.adminDb.wholesalePrice.findFirst({
      where: {
        resellerId,
        productId: product.id,
        validFrom: { lte: when },
        OR: [{ validTo: null }, { validTo: { gt: when } }],
      },
      orderBy: { validFrom: 'desc' },
    });
    return override?.priceCents ?? product.baseWholesaleCents;
  }
}

/** Exported for unit tests of average rounding. */
export function averageCostCents(totalValueCents: number, qty: number): number {
  if (qty <= 0) {
    return 0;
  }
  return roundCents(totalValueCents / qty);
}
