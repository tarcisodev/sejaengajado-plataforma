import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

const closeSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  closedAt: z.string().datetime().optional(),
});

@Injectable()
export class AdminInvoicesService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  async list(options: { limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const rows = await this.db.resellerInvoice.findMany({
      include: { lines: true, reseller: true },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      resellerId: row.resellerId,
      period: row.period,
      status: row.status,
      totalCents: row.totalCents,
      dueDate: row.dueDate?.toISOString() ?? null,
      gatewayPaymentId: row.gatewayPaymentId,
      paymentStatus: null,
      invoiceUrl: null,
      bankSlipUrl: null,
      pixCopyPaste: null,
      lines: row.lines.map((line) => ({
        description: line.description,
        qty: line.qty,
        unitCents: line.unitCents,
        totalCents: line.totalCents,
      })),
    }));
  }

  /**
   * Fecha/gera snapshot de fatura do mês (YYYY-MM) para um revendedor.
   * Idempotente: se já existir, devolve a existente.
   */
  async close(resellerId: string, body: unknown) {
    const parsed = closeSchema.safeParse(body);
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

    const reseller = await this.db.reseller.findUnique({
      where: { id: resellerId },
      include: { plan: true },
    });
    if (!reseller) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Revendedor não encontrado' });
    }

    const existing = await this.db.resellerInvoice.findUnique({
      where: {
        resellerId_period: { resellerId, period: parsed.data.period },
      },
      include: { lines: true },
    });
    if (existing) {
      return this.toCloseDto(existing, reseller);
    }

    const activeSites = await this.db.site.findMany({
      where: {
        resellerId,
        isDemo: false,
        status: { in: ['PUBLISHED', 'READ_ONLY'] },
      },
      select: { id: true },
    });

    const monthly = reseller.plan.monthlyFeeCents;
    const perSite = 0;
    const totalCents = monthly + activeSites.length * perSite;

    const created = await this.db.resellerInvoice.create({
      data: {
        resellerId,
        period: parsed.data.period,
        status: totalCents > 0 ? 'OPEN' : 'VOID',
        totalCents,
        closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : new Date(),
        lines: {
          create: [
            {
              description: `Mensalidade — ${parsed.data.period}`,
              qty: 1,
              unitCents: monthly,
              totalCents: monthly,
            },
            ...(activeSites.length
              ? [
                  {
                    description: `Sites ativos (${activeSites.length})`,
                    qty: activeSites.length,
                    unitCents: perSite,
                    totalCents: activeSites.length * perSite,
                  },
                ]
              : []),
          ],
        },
      },
      include: { lines: true },
    });

    return this.toCloseDto(created, reseller);
  }

  private toCloseDto(
    invoice: {
      id: string;
      resellerId: string;
      period: string;
      totalCents: number;
      closedAt: Date | null;
      lines: { description: string; qty: number; unitCents: number; totalCents: number }[];
    },
    reseller: { plan: { monthlyFeeCents: number } },
  ) {
    return {
      id: invoice.id,
      resellerId: invoice.resellerId,
      mes: invoice.period,
      closedAt: (invoice.closedAt ?? new Date()).toISOString(),
      mensalidadeCentavos: reseller.plan.monthlyFeeCents,
      custoPorSiteAtivoCentavos: 0,
      activeSiteIds: [] as string[],
      totalCentavos: invoice.totalCents,
      lines: invoice.lines,
    };
  }
}
