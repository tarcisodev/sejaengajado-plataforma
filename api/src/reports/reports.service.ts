import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

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
  return {
    from: from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to: to ?? now,
  };
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

  salesReportForCurrent(fromRaw?: string, toRaw?: string) {
    const range = parseRange(fromRaw, toRaw);
    return this.buildSalesReport(requireTenantResellerId(), range.from, range.to, 'tenant');
  }

  async salesReportForReseller(resellerId: string, fromRaw?: string, toRaw?: string) {
    await this.requireReseller(resellerId);
    const range = parseRange(fromRaw, toRaw);
    return this.buildSalesReport(resellerId, range.from, range.to, 'admin');
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
  ) {
    const db = this.client(mode);
    const sales = await db.sale.findMany({
      where: {
        ...(mode === 'admin' ? { resellerId } : {}),
        status: 'RECORDED',
        createdAt: { gte: from, lte: to },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    let costCents = 0;
    let chargedCents = 0;
    let predicted = 0;
    for (const sale of sales) {
      for (const item of sale.items) {
        costCents += item.qty * item.unitCostCents;
        chargedCents += item.qty * item.unitPriceCents;
      }
      predicted += computePredictedMargin(sale.items);
    }

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
      salesCount: sales.length,
      costCents,
      chargedCents,
      predictedMarginCents: predicted,
      realizedMarginCents: saleIn - invoiceOut,
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
