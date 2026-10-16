import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

function parseDayBound(raw: string, endOfDay: boolean): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [
        {
          path: endOfDay ? 'to' : 'from',
          code: 'invalid_date',
          message: 'Use YYYY-MM-DD',
        },
      ],
    });
  }
  const iso = endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Dados inválidos',
      fields: [
        {
          path: endOfDay ? 'to' : 'from',
          code: 'invalid_date',
          message: 'Data inválida',
        },
      ],
    });
  }
  return date;
}

@Injectable()
export class AdminPaymentsService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  async list(
    options: { limit?: number; cursor?: string; from?: string; to?: string } = {},
  ) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;

    const paidAt: Prisma.DateTimeNullableFilter = {};
    if (options.from) {
      paidAt.gte = parseDayBound(options.from, false);
    }
    if (options.to) {
      paidAt.lte = parseDayBound(options.to, true);
    }

    const periodFilter =
      options.from || options.to
        ? { paidAt: { ...paidAt, not: null } }
        : undefined;

    const rows = await this.db.payment.findMany({
      where: {
        ...periodFilter,
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
      select: {
        id: true,
        resellerId: true,
        orderId: true,
        method: true,
        status: true,
        amountCents: true,
        gatewayPaymentId: true,
        paidAt: true,
        createdAt: true,
      },
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }
}
