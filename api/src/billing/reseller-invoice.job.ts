import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PlanType, ProductCode } from '@prisma/client';

import { spLocalDate, spMonthRangeUtc } from '../common/sao-paulo-time';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../payments/domain/payment-gateway.port';
import { SYSTEM_PRISMA, type SystemPrisma } from '../tenant/prisma.module';
import {
  previousInvoicePeriodSp,
  resellerInvoiceIdempotencyKey,
} from './invoice-period';
import { resolveWholesaleCentsAdmin } from './resolve-wholesale-admin';

const LOCK_KEY = 'billing:reseller-invoice';
const DUE_DAYS = 7;

export interface ResellerInvoiceRunResult {
  skippedLock: boolean;
  scanned: number;
  created: number;
  reused: number;
  charged: number;
}

@Injectable()
export class ResellerInvoiceJob {
  private readonly logger = new Logger(ResellerInvoiceJob.name);

  constructor(
    @Inject(SYSTEM_PRISMA) private readonly db: SystemPrisma,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Monthly close: snapshot sites + plaques + plan fee → charge via PaymentGateway.
   * Idempotent per (resellerId, period) + Idempotency-Key on createCharge.
   */
  async runOnce(now = new Date()): Promise<ResellerInvoiceRunResult> {
    const locked = await this.db.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${LOCK_KEY})) AS ok
    `;
    if (!locked[0]?.ok) {
      return { skippedLock: true, scanned: 0, created: 0, reused: 0, charged: 0 };
    }

    try {
      return await this.process(now);
    } finally {
      await this.db.$executeRaw`SELECT pg_advisory_unlock(hashtext(${LOCK_KEY}))`;
    }
  }

  private async process(now: Date): Promise<ResellerInvoiceRunResult> {
    const period = previousInvoicePeriodSp(now);
    const resellers = await this.db.reseller.findMany({
      where: {
        isPlatform: false,
        status: { in: ['ACTIVE', 'DELINQUENT'] },
      },
      include: { plan: true },
    });

    let created = 0;
    let reused = 0;
    let charged = 0;

    for (const reseller of resellers) {
      const existing = await this.db.resellerInvoice.findUnique({
        where: {
          resellerId_period: { resellerId: reseller.id, period },
        },
        include: { lines: true },
      });

      if (existing) {
        reused += 1;
        if (!existing.gatewayPaymentId && existing.totalCents > 0) {
          const did = await this.ensureCharge(reseller, existing, now);
          if (did) {
            charged += 1;
          }
        }
        continue;
      }

      const lines = await this.buildLines(reseller.id, reseller.plan.monthlyFeeCents, period, now);
      const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);

      const invoice = await this.db.resellerInvoice.create({
        data: {
          resellerId: reseller.id,
          period,
          status: totalCents > 0 ? 'OPEN' : 'VOID',
          totalCents,
          dueDate: addDaysSp(now, DUE_DAYS),
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              description: line.description,
              qty: line.qty,
              unitCents: line.unitCents,
              totalCents: line.totalCents,
            })),
          },
        },
      });
      created += 1;

      if (totalCents > 0) {
        const did = await this.ensureCharge(reseller, invoice, now);
        if (did) {
          charged += 1;
        }
      }
    }

    return {
      skippedLock: false,
      scanned: resellers.length,
      created,
      reused,
      charged,
    };
  }

  private async buildLines(
    resellerId: string,
    monthlyFeeCents: number,
    period: string,
    now: Date,
  ): Promise<
    {
      productId: string | null;
      description: string;
      qty: number;
      unitCents: number;
      totalCents: number;
    }[]
  > {
    const lines: {
      productId: string | null;
      description: string;
      qty: number;
      unitCents: number;
      totalCents: number;
    }[] = [];

    const sites = await this.db.site.findMany({
      where: {
        resellerId,
        isDemo: false,
        status: { in: ['PUBLISHED', 'READ_ONLY'] },
      },
      include: { plan: true },
    });

    const products = await this.db.product.findMany();
    const byCode = new Map(products.map((p) => [p.code, p]));

    for (const site of sites) {
      const code = productCodeForPlan(site.plan.type, site.plan.code);
      const product = byCode.get(code);
      if (!product) {
        continue;
      }
      const unitCents = await resolveWholesaleCentsAdmin(
        this.db,
        resellerId,
        product.id,
        now,
      );
      lines.push({
        productId: product.id,
        description: `Site ${site.slug} (${site.status})`,
        qty: 1,
        unitCents,
        totalCents: unitCents,
      });
    }

    if (monthlyFeeCents > 0) {
      lines.push({
        productId: null,
        description: `Mensalidade plano — ${period}`,
        qty: 1,
        unitCents: monthlyFeeCents,
        totalCents: monthlyFeeCents,
      });
    }

    const { from, toExclusive } = monthRangeFromPeriod(period);
    const plaqueIns = await this.db.plaqueMovement.groupBy({
      by: ['plaqueType'],
      where: {
        resellerId,
        type: 'IN',
        reason: { contains: 'TRANSFER' },
        createdAt: { gte: from, lt: toExclusive },
      },
      _sum: { qty: true },
    });

    for (const row of plaqueIns) {
      const code: ProductCode =
        row.plaqueType === 'QR' ? 'PLAQUE_QR' : 'PLAQUE_NFC';
      const product = byCode.get(code);
      if (!product) {
        continue;
      }
      const qty = row._sum.qty ?? 0;
      if (qty <= 0) {
        continue;
      }
      const unitCents = await resolveWholesaleCentsAdmin(
        this.db,
        resellerId,
        product.id,
        now,
      );
      lines.push({
        productId: product.id,
        description: `Placas ${row.plaqueType} transferidas — ${period}`,
        qty,
        unitCents,
        totalCents: unitCents * qty,
      });
    }

    return lines;
  }

  private async ensureCharge(
    reseller: { id: string; name: string; gatewayCustomerId: string | null },
    invoice: { id: string; period: string; totalCents: number; gatewayPaymentId: string | null },
    now: Date,
  ): Promise<boolean> {
    if (invoice.gatewayPaymentId || invoice.totalCents <= 0) {
      return false;
    }

    let customerId = reseller.gatewayCustomerId;
    if (!customerId) {
      const created = await this.gateway.createCustomer({
        name: reseller.name,
        email: `reseller-${reseller.id}@billing.local`,
        externalReference: reseller.id,
      });
      customerId = created.gatewayCustomerId;
      await this.db.reseller.update({
        where: { id: reseller.id },
        data: { gatewayCustomerId: customerId },
      });
    }

    const plan = await this.db.plan.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!plan) {
      this.logger.warn('Nenhum Plan para Order de fatura');
      return false;
    }

    const idempotencyKey = resellerInvoiceIdempotencyKey(reseller.id, invoice.period);
    const charge = await this.gateway.createCharge({
      gatewayCustomerId: customerId,
      amountCents: invoice.totalCents,
      method: 'BOLETO',
      dueDate: spLocalDate(addDaysSp(now, DUE_DAYS)),
      description: `Fatura ${invoice.period}`,
      idempotencyKey,
      externalReference: invoice.id,
    });

    const order = await this.db.order.create({
      data: {
        resellerId: reseller.id,
        planId: plan.id,
        status: 'PENDING',
        amountCents: invoice.totalCents,
        payment: {
          create: {
            resellerId: reseller.id,
            method: 'BOLETO',
            status: 'PENDING',
            amountCents: invoice.totalCents,
            gatewayPaymentId: charge.gatewayPaymentId,
          },
        },
      },
      include: { payment: true },
    });

    await this.db.resellerInvoice.update({
      where: { id: invoice.id },
      data: {
        gatewayPaymentId: charge.gatewayPaymentId,
        status: 'OPEN',
      },
    });

    void order;
    return true;
  }
}

function productCodeForPlan(type: PlanType, planCode: string): ProductCode {
  if (type === 'RECURRING') {
    return 'SITE_PRO';
  }
  if (type === 'ANNUAL_HOSTING') {
    return 'RENEWAL';
  }
  if (/ENGAJADO_PRO|SITE_PRO/i.test(planCode)) {
    return 'SITE_PRO';
  }
  if (/RENEW/i.test(planCode)) {
    return 'RENEWAL';
  }
  return 'SITE_ONE_TIME';
}

function addDaysSp(at: Date, days: number): Date {
  return new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
}

function monthRangeFromPeriod(period: string): { from: Date; toExclusive: Date } {
  const [y, m] = period.split('-').map(Number) as [number, number];
  // Mid-month sample to reuse spMonthRangeUtc
  const sample = new Date(Date.UTC(y, m - 1, 15, 15, 0, 0));
  return spMonthRangeUtc(sample);
}
