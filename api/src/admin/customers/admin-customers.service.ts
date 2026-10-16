import { Inject, Injectable } from '@nestjs/common';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

@Injectable()
export class AdminCustomersService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  async list(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.customer.findMany({
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
}
