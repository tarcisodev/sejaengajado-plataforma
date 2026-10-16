import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { SitesService, createSiteSchema } from '../../reseller/sites/sites.service';
import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';
import { runWithTenantAsync } from '../../tenant/tenant.context';

@Injectable()
export class AdminSitesService {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly db: AdminPrisma,
    private readonly sites: SitesService,
  ) {}

  async list(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.site.findMany({
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
      include: { customer: true, plan: true, template: true },
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }

  /**
   * Cria site para um cliente reutilizando SitesService.create no tenant da revenda.
   */
  async create(body: unknown) {
    const parsed = createSiteSchema.safeParse(body);
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

    const customer = await this.db.customer.findUnique({
      where: { id: parsed.data.customerId },
    });
    if (!customer) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }

    return runWithTenantAsync(
      {
        userId: 'admin',
        role: 'RESELLER',
        resellerId: customer.resellerId,
      },
      () => this.sites.create(customer.resellerId, body),
    );
  }
}
