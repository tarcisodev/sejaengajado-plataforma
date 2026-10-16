import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { SUPABASE_ADMIN, type SupabaseAdminClient } from '../../auth/supabase-admin';
import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../../common/cursor';
import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

export const createResellerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  resellerPlanId: z.string().uuid(),
});

export const patchResellerSchema = z.object({
  name: z.string().min(1).optional(),
  resellerPlanId: z.string().uuid().optional(),
  document: z.string().max(32).optional(),
  phone: z.string().max(32).optional(),
  addressLine: z.string().max(200).optional(),
  addressCity: z.string().max(80).optional(),
  addressUf: z.string().max(2).optional(),
  addressCep: z.string().max(16).optional(),
  notes: z.string().max(2000).optional(),
});

export const blockSchema = z.object({
  reason: z.string().min(1),
});

export const planSchema = z.object({
  name: z.string().min(1),
  monthlyFeeCents: z.number().int().nonnegative(),
  siteLimit: z.number().int().positive().nullable().optional(),
});

@Injectable()
export class ResellersService {
  constructor(
    @Inject(ADMIN_PRISMA) private readonly db: AdminPrisma,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseAdminClient,
  ) {}

  assertOperable(status: string): void {
    if (status === 'BLOCKED') {
      throw new ForbiddenException({
        code: 'RESELLER_BLOCKED',
        message: 'Revendedor bloqueado',
      });
    }
    if (status === 'DELINQUENT') {
      throw new ForbiddenException({
        code: 'RESELLER_DELINQUENT',
        message: 'Revendedor inadimplente',
      });
    }
  }

  async list(options: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.reseller.findMany({
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
      include: { plan: true },
    });
    return paginate(rows, limit, (row) => encodeTimeIdCursor(row.createdAt, row.id));
  }

  async get(id: string) {
    const row = await this.db.reseller.findUnique({
      where: { id },
      include: { plan: true, users: true },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Não encontrado' });
    }
    return row;
  }

  async create(input: z.infer<typeof createResellerSchema>) {
    const plan = await this.db.resellerPlan.findUnique({ where: { id: input.resellerPlanId } });
    if (!plan) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'resellerPlanId', code: 'not_found', message: 'Plano inválido' }],
      });
    }

    const invited = await this.supabaseAdmin.inviteUserByEmail(input.email);
    // Link de recuperação/convite para o admin copiar quando o e-mail fica só capturado em local (P16).
    let inviteActionLink: string | null = null;
    try {
      const recovery = await this.supabaseAdmin.generateRecoveryLink(input.email);
      inviteActionLink = recovery.actionLink;
    } catch {
      inviteActionLink = null;
    }

    const reseller = await this.db.reseller.create({
      data: {
        name: input.name,
        resellerPlanId: input.resellerPlanId,
        status: 'ACTIVE',
        users: {
          create: {
            supabaseId: invited.id,
            email: invited.email.toLowerCase(),
            role: 'RESELLER',
            status: 'ACTIVE',
          },
        },
      },
      include: { users: true, plan: true },
    });

    await this.db.lifecycleEvent.create({
      data: {
        resellerId: reseller.id,
        fromStatus: 'NONE',
        toStatus: 'ACTIVE',
        reason: 'created',
      },
    });

    return { ...reseller, inviteActionLink };
  }

  async patch(id: string, input: z.infer<typeof patchResellerSchema>) {
    await this.get(id);
    return this.db.reseller.update({
      where: { id },
      data: {
        name: input.name,
        resellerPlanId: input.resellerPlanId,
        // Profile columns from migration 20261016170000_reseller_profile
        document: input.document,
        phone: input.phone,
        addressLine: input.addressLine,
        addressCity: input.addressCity,
        addressUf: input.addressUf,
        addressCep: input.addressCep,
        notes: input.notes,
      } as Parameters<AdminPrisma['reseller']['update']>[0]['data'],
      include: { plan: true, users: true },
    });
  }

  async sendPasswordReset(id: string): Promise<{ inviteActionLink: string | null }> {
    const row = await this.get(id);
    const email = row.users?.[0]?.email;
    if (!email) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Usuário do revendedor não encontrado' });
    }
    try {
      const recovery = await this.supabaseAdmin.generateRecoveryLink(email);
      return { inviteActionLink: recovery.actionLink };
    } catch {
      return { inviteActionLink: null };
    }
  }

  async resetMfa(id: string): Promise<{ removed: number }> {
    const row = await this.get(id);
    const supabaseId = row.users?.[0]?.supabaseId;
    if (!supabaseId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Usuário do revendedor não encontrado' });
    }
    return this.supabaseAdmin.unenrollMfaFactors(supabaseId);
  }

  async block(id: string, body: unknown) {
    const parsed = blockSchema.safeParse(body);
    if (!parsed.success || !parsed.data.reason.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [{ path: 'reason', code: 'required', message: 'Motivo obrigatório' }],
      });
    }
    const before = await this.get(id);
    const updated = await this.db.reseller.update({
      where: { id },
      data: {
        status: 'BLOCKED',
        blockedAt: new Date(),
        blockedReason: parsed.data.reason.trim(),
      },
    });
    await this.db.lifecycleEvent.create({
      data: {
        resellerId: id,
        fromStatus: before.status,
        toStatus: 'BLOCKED',
        reason: parsed.data.reason.trim(),
      },
    });
    return updated;
  }

  async unblock(id: string) {
    const before = await this.get(id);
    const updated = await this.db.reseller.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        blockedAt: null,
        blockedReason: null,
        blockedById: null,
      },
    });
    await this.db.lifecycleEvent.create({
      data: {
        resellerId: id,
        fromStatus: before.status,
        toStatus: 'ACTIVE',
        reason: 'unblocked',
      },
    });
    return updated;
  }

  async suspendSites(id: string) {
    await this.get(id);
    const result = await this.db.site.updateMany({
      where: {
        resellerId: id,
        status: { in: ['PUBLISHED', 'READ_ONLY', 'DRAFT'] },
      },
      data: { status: 'SUSPENDED' },
    });
    await this.db.lifecycleEvent.create({
      data: {
        resellerId: id,
        fromStatus: 'MIXED',
        toStatus: 'SITES_SUSPENDED',
        reason: 'fraud_suspend_sites',
      },
    });
    return { count: result.count };
  }

  async offerMigration(id: string) {
    const before = await this.get(id);
    await this.db.lifecycleEvent.create({
      data: {
        resellerId: id,
        fromStatus: before.status,
        toStatus: before.status,
        reason: 'migration_offered',
      },
    });
    return { ok: true };
  }

  async summary(id: string) {
    const reseller = await this.get(id);
    const [sites, sales, stock] = await Promise.all([
      this.db.site.count({ where: { resellerId: id } }),
      this.db.sale.count({ where: { resellerId: id, status: 'RECORDED' } }),
      this.db.$queryRaw<{ plaque_type: string; qty: number }[]>`
        SELECT plaque_type, qty FROM plaque_stock WHERE reseller_id = ${id}::uuid
      `,
    ]);
    return {
      id: reseller.id,
      name: reseller.name,
      status: reseller.status,
      sites,
      sales,
      stock,
    };
  }

  async impersonate(id: string) {
    const before = await this.get(id);
    const after = await this.get(id);
    if (before.updatedAt.getTime() !== after.updatedAt.getTime()) {
      throw new ForbiddenException({
        code: 'IMPERSONATE_MUTATION',
        message: 'Impersonação não pode alterar dados',
      });
    }
    return {
      mode: 'read' as const,
      resellerId: before.id,
      name: before.name,
      status: before.status,
    };
  }

  async listPlans() {
    return this.db.resellerPlan.findMany({ orderBy: { name: 'asc' } });
  }

  async createPlan(body: unknown) {
    const parsed = planSchema.safeParse(body);
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
    return this.db.resellerPlan.create({
      data: {
        name: parsed.data.name,
        monthlyFeeCents: parsed.data.monthlyFeeCents,
        siteLimit: parsed.data.siteLimit ?? null,
      },
    });
  }

  async patchPlan(id: string, body: unknown) {
    const parsed = planSchema.partial().safeParse(body);
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
    return this.db.resellerPlan.update({
      where: { id },
      data: parsed.data,
    });
  }
}
