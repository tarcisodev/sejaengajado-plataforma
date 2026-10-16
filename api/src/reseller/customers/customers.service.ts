import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';

import { SUPABASE_ADMIN, type SupabaseAdminClient } from '../../auth/supabase-admin';
import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { PRISMA, type TenantPrisma } from '../../tenant/prisma.module';
import { assertResellerOperable } from '../reseller-status';

export const customerBodySchema = z.object({
  name: z.string().min(1),
  doc: z.string().default(''),
  whatsapp: z.string().default(''),
  city: z.string().default(''),
  /** Quando informado, convida o cliente (GoTrue) e cria User CUSTOMER. */
  email: z.union([z.string().email(), z.literal('')]).optional(),
});

@Injectable()
export class CustomersService {
  constructor(
    @Inject(PRISMA) private readonly db: TenantPrisma,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseAdminClient,
  ) {}

  private async requireOperableReseller(resellerId: string) {
    const reseller = await this.db.reseller.findUnique({
      where: { id: resellerId },
      select: { status: true },
    });
    if (!reseller) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    assertResellerOperable(reseller.status);
  }

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

  async get(id: string) {
    const row = await this.db.customer.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    return row;
  }

  async create(resellerId: string, body: unknown) {
    await this.requireOperableReseller(resellerId);
    const parsed = customerBodySchema.safeParse(body);
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

    const email = parsed.data.email?.trim().toLowerCase() || null;
    if (!email) {
      return this.db.customer.create({
        data: {
          resellerId,
          name: parsed.data.name,
          doc: parsed.data.doc,
          whatsapp: parsed.data.whatsapp,
          city: parsed.data.city,
        },
      });
    }

    const existing = await this.db.customer.findFirst({
      where: { resellerId, email },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'E-mail de cliente já cadastrado nesta revenda',
      });
    }

    // Convite vai só por e-mail ao cliente. O link de ação/recuperação nunca volta ao
    // revendedor (daria acesso à conta do cliente) — copiar link é exclusivo do admin.
    const invited = await this.supabaseAdmin.inviteUserByEmail(email);

    const user = await this.db.user.create({
      data: {
        supabaseId: invited.id,
        email,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        resellerId,
      },
    });

    const customer = await this.db.customer.create({
      data: {
        resellerId,
        name: parsed.data.name,
        doc: parsed.data.doc,
        whatsapp: parsed.data.whatsapp,
        city: parsed.data.city,
        email,
        userId: user.id,
      },
      include: { user: true },
    });

    return customer;
  }

  async update(id: string, body: unknown) {
    await this.get(id);
    const parsed = customerBodySchema.partial().safeParse(body);
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
    const { email: _email, ...data } = parsed.data;
    return this.db.customer.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.get(id);
    // Sites "excluídos" são só arquivados (soft delete) e não bloqueiam a remoção do cliente.
    const activeSites = await this.db.site.count({
      where: { customerId: id, status: { not: 'ARCHIVED' } },
    });
    if (activeSites > 0) {
      throw new ConflictException({
        code: 'VALIDATION_FAILED',
        message: 'Cliente possui sites',
        fields: [{ path: 'id', code: 'has_sites', message: 'Remova os sites antes' }],
      });
    }
    // Arquivados sem histórico (placas, scans, eventos, assinaturas) podem sair junto;
    // os com histórico precisam ficar (FK) e mantêm o cliente.
    const archived = await this.db.site.findMany({
      where: { customerId: id, status: 'ARCHIVED' },
      select: {
        id: true,
        _count: {
          select: {
            plaques: true,
            scanEvents: true,
            plaqueMovements: true,
            lifecycleEvents: true,
            subscriptions: true,
          },
        },
      },
    });
    const withHistory = archived.some((site) =>
      Object.values(site._count).some((count) => count > 0),
    );
    if (withHistory) {
      throw new ConflictException({
        code: 'VALIDATION_FAILED',
        message: 'Cliente possui sites arquivados com histórico e não pode ser removido',
        fields: [{ path: 'id', code: 'has_site_history', message: 'Sites com histórico' }],
      });
    }
    if (archived.length > 0) {
      await this.db.site.deleteMany({
        where: { id: { in: archived.map((site) => site.id) }, status: 'ARCHIVED' },
      });
    }
    await this.db.customer.delete({ where: { id } });
    return { ok: true };
  }
}
