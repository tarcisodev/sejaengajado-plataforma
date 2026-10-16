import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  decodeTimeIdCursor,
  encodeTimeIdCursor,
  paginate,
} from '../common/cursor';
import { spMonthRangeUtc } from '../common/sao-paulo-time';
import { LedgerService } from '../ledger/ledger.service';
import { predictedMarginCents as computePredictedMargin } from '../sales/sales.service';
import { StockService } from '../stock/stock.service';
import {
  ADMIN_PRISMA,
  PRISMA,
  type AdminPrisma,
  type TenantPrisma,
} from '../tenant/prisma.module';
import { requireTenantResellerId } from '../tenant/tenant.context';

/** Max inclusive span for /reports/sales (calendar days). */
export const SALES_REPORT_MAX_DAYS = 366;
/** Max sales rows per page (project cursor pagination). */
export const SALES_REPORT_MAX_LIMIT = 100;

function parseRange(fromRaw?: string, toRaw?: string): { from: Date; to: Date } {
  const fields: { path: string; code: string; message: string }[] = [];
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if (fromRaw && (!from || Number.isNaN(from.getTime()))) {
    fields.push({ path: 'from', code: 'invalid_date', message: 'Data inválida' });
  }
  if (toRaw && (!to || Number.isNaN(to.getTime()))) {
    fields.push({ path: 'to', code: 'invalid_date', message: 'Data inválida' });
  }
  if (fields.length) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields,
    });
  }
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [{ path: 'from', code: 'range', message: 'from deve ser ≤ to' }],
    });
  }
  const now = new Date();
  const resolved = {
    from: from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to: to ?? now,
  };
  const spanMs = resolved.to.getTime() - resolved.from.getTime();
  const maxMs = SALES_REPORT_MAX_DAYS * 24 * 60 * 60 * 1000;
  if (spanMs > maxMs) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [
        {
          path: 'to',
          code: 'range_too_long',
          message: `Intervalo máximo de ${SALES_REPORT_MAX_DAYS} dias`,
        },
      ],
    });
  }
  return resolved;
}

function parseLimit(limitRaw?: string): number {
  if (limitRaw === undefined || limitRaw === '') {
    return 20;
  }
  const n = Number(limitRaw);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [{ path: 'limit', code: 'invalid', message: 'limit deve ser inteiro ≥ 1' }],
    });
  }
  return Math.min(n, SALES_REPORT_MAX_LIMIT);
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PRISMA) private readonly db: TenantPrisma,
    @Inject(ADMIN_PRISMA) private readonly adminDb: AdminPrisma,
    private readonly ledger: LedgerService,
    private readonly stock: StockService,
  ) {}

  dashboardForCurrent(at = new Date()) {
    return this.buildDashboard(requireTenantResellerId(), at, 'tenant');
  }

  async dashboardForReseller(resellerId: string, at = new Date()) {
    await this.requireReseller(resellerId);
    return this.buildDashboard(resellerId, at, 'admin');
  }

  salesReportForCurrent(options: {
    from?: string;
    to?: string;
    cursor?: string;
    limit?: string;
  }) {
    const range = parseRange(options.from, options.to);
    return this.buildSalesReport(
      requireTenantResellerId(),
      range.from,
      range.to,
      'tenant',
      options.cursor,
      parseLimit(options.limit),
    );
  }

  async salesReportForReseller(
    resellerId: string,
    options: { from?: string; to?: string; cursor?: string; limit?: string },
  ) {
    await this.requireReseller(resellerId);
    const range = parseRange(options.from, options.to);
    return this.buildSalesReport(
      resellerId,
      range.from,
      range.to,
      'admin',
      options.cursor,
      parseLimit(options.limit),
    );
  }

  private async requireReseller(id: string) {
    const row = await this.adminDb.reseller.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Revendedor não encontrado' });
    }
    return row;
  }

  private client(mode: 'tenant' | 'admin') {
    return mode === 'tenant' ? this.db : this.adminDb;
  }

  private async buildDashboard(resellerId: string, at: Date, mode: 'tenant' | 'admin') {
    const db = this.client(mode);
    const { from, toExclusive } = spMonthRangeUtc(at);

    const [activeSites, sales, balanceCents, stock, openInvoice, saleIn, invoiceOut] =
      await Promise.all([
        db.site.count({
          where: {
            ...(mode === 'admin' ? { resellerId } : {}),
            status: { in: ['PUBLISHED', 'READ_ONLY'] },
            isDemo: false,
          },
        }),
        db.sale.findMany({
          where: {
            ...(mode === 'admin' ? { resellerId } : {}),
            status: 'RECORDED',
            createdAt: { gte: from, lt: toExclusive },
          },
          include: { items: true },
        }),
        mode === 'tenant'
          ? this.ledger.balance(at)
          : this.adminBalance(resellerId, at),
        mode === 'tenant'
          ? this.stock.listStockForCurrent()
          : this.stock.listStock(resellerId),
        db.resellerInvoice.findFirst({
          where: {
            ...(mode === 'admin' ? { resellerId } : {}),
            status: { in: ['OPEN', 'OVERDUE'] },
          },
          orderBy: { period: 'desc' },
          include: { lines: true },
        }),
        this.sumLedger(db, resellerId, mode, 'IN', 'SALE', from, toExclusive, true),
        this.sumLedger(
          db,
          resellerId,
          mode,
          'OUT',
          'PLATFORM_INVOICE',
          from,
          toExclusive,
          true,
        ),
      ]);

    let monthSalesCents = 0;
    let predictedMargin = 0;
    for (const sale of sales) {
      for (const item of sale.items) {
        monthSalesCents += item.qty * item.unitPriceCents;
      }
      predictedMargin += computePredictedMargin(sale.items);
    }

    return {
      activeSites,
      monthSalesCents,
      predictedMarginCents: predictedMargin,
      realizedMarginCents: saleIn - invoiceOut,
      balanceCents,
      stock: stock.items.map((row) => ({
        plaqueType: row.plaqueType,
        qty: row.qty,
      })),
      openInvoice: openInvoice
        ? {
            id: openInvoice.id,
            period: openInvoice.period,
            totalCents: openInvoice.totalCents,
            status: openInvoice.status,
            lines: openInvoice.lines.map((line) => ({
              description: line.description,
              qty: line.qty,
              unitCents: line.unitCents,
              totalCents: line.totalCents,
            })),
          }
        : null,
      monthFrom: from.toISOString(),
      monthToExclusive: toExclusive.toISOString(),
    };
  }

  private async buildSalesReport(
    resellerId: string,
    from: Date,
    to: Date,
    mode: 'tenant' | 'admin',
    cursorRaw: string | undefined,
    limit: number,
  ) {
    const db = this.client(mode);
    let cursor: { createdAt: Date; id: string } | null = null;
    if (cursorRaw) {
      try {
        cursor = decodeTimeIdCursor(cursorRaw);
      } catch {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Dados inválidos',
          fields: [{ path: 'cursor', code: 'invalid', message: 'Cursor inválido' }],
        });
      }
    }

    const rows = await db.sale.findMany({
      where: {
        ...(mode === 'admin' ? { resellerId } : {}),
        status: 'RECORDED',
        createdAt: { gte: from, lte: to },
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { items: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const page = paginate(rows, limit, (row) =>
      encodeTimeIdCursor(row.createdAt, row.id),
    );

    // Totals for the full range (not just the page) via aggregates + ledger.
    const totals = await this.salesTotals(db, resellerId, mode, from, to);
    const saleIn = await this.sumLedger(db, resellerId, mode, 'IN', 'SALE', from, to);
    const invoiceOut = await this.sumLedger(
      db,
      resellerId,
      mode,
      'OUT',
      'PLATFORM_INVOICE',
      from,
      to,
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      salesCount: totals.salesCount,
      costCents: totals.costCents,
      chargedCents: totals.chargedCents,
      predictedMarginCents: totals.predictedMarginCents,
      realizedMarginCents: saleIn - invoiceOut,
      items: page.items.map((sale) => {
        const costCents = sale.items.reduce(
          (sum, item) => sum + item.qty * item.unitCostCents,
          0,
        );
        const chargedCents = sale.items.reduce(
          (sum, item) => sum + item.qty * item.unitPriceCents,
          0,
        );
        return {
          id: sale.id,
          createdAt: sale.createdAt.toISOString(),
          costCents,
          chargedCents,
          predictedMarginCents: computePredictedMargin(sale.items),
          items: sale.items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            unitCostCents: item.unitCostCents,
            unitPriceCents: item.unitPriceCents,
          })),
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  private async salesTotals(
    db: TenantPrisma | AdminPrisma,
    resellerId: string,
    mode: 'tenant' | 'admin',
    from: Date,
    to: Date,
  ) {
    const salesCount = await db.sale.count({
      where: {
        ...(mode === 'admin' ? { resellerId } : {}),
        status: 'RECORDED',
        createdAt: { gte: from, lte: to },
      },
    });

    // Integer money: SUM(qty * unit_*) in SQL — avoids loading every SaleItem.
    const runSum = () =>
      db.$queryRaw<
        { cost_cents: bigint | number | null; charged_cents: bigint | number | null }[]
      >`
        SELECT
          COALESCE(SUM(si.qty * si.unit_cost_cents), 0) AS cost_cents,
          COALESCE(SUM(si.qty * si.unit_price_cents), 0) AS charged_cents
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE s.status = 'RECORDED'
          AND s.reseller_id = ${resellerId}::uuid
          AND s.created_at >= ${from}
          AND s.created_at <= ${to}
      `;

    const scoped =
      mode === 'tenant'
        ? await db.$transaction(async (tx) =>
            tx.$queryRaw<
              { cost_cents: bigint | number | null; charged_cents: bigint | number | null }[]
            >`
              SELECT
                COALESCE(SUM(si.qty * si.unit_cost_cents), 0) AS cost_cents,
                COALESCE(SUM(si.qty * si.unit_price_cents), 0) AS charged_cents
              FROM sale_items si
              INNER JOIN sales s ON s.id = si.sale_id
              WHERE s.status = 'RECORDED'
                AND s.reseller_id = ${resellerId}::uuid
                AND s.created_at >= ${from}
                AND s.created_at <= ${to}
            `,
          )
        : await runSum();

    const costCents = Number(scoped[0]?.cost_cents ?? 0);
    const chargedCents = Number(scoped[0]?.charged_cents ?? 0);

    return {
      salesCount,
      costCents,
      chargedCents,
      predictedMarginCents: chargedCents - costCents,
    };
  }

  private async sumLedger(
    db: TenantPrisma | AdminPrisma,
    resellerId: string,
    mode: 'tenant' | 'admin',
    type: 'IN' | 'OUT',
    category: 'SALE' | 'PLATFORM_INVOICE',
    from: Date,
    to: Date,
    exclusiveEnd = false,
  ): Promise<number> {
    const agg = await db.ledgerEntry.aggregate({
      where: {
        ...(mode === 'admin' ? { resellerId } : {}),
        type,
        category,
        createdAt: exclusiveEnd
          ? { gte: from, lt: to }
          : { gte: from, lte: to },
      },
      _sum: { amountCents: true },
    });
    return agg._sum.amountCents ?? 0;
  }

  private async adminBalance(resellerId: string, at: Date): Promise<number> {
    const groups = await this.adminDb.ledgerEntry.groupBy({
      by: ['type'],
      where: { resellerId, createdAt: { lte: at } },
      _sum: { amountCents: true },
    });
    let total = 0;
    for (const group of groups) {
      const sum = group._sum.amountCents ?? 0;
      total += group.type === 'IN' ? sum : -sum;
    }
    return total;
  }
}

/** Detect Seq Scan on a named relation in EXPLAIN JSON. */
export function explainHasSeqScan(planJson: unknown, relation: string): boolean {
  const text = JSON.stringify(planJson);
  return text.includes(`"Node Type":"Seq Scan"`) && text.includes(`"Relation Name":"${relation}"`);
}
