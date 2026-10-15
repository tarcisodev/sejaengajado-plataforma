import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

export const planBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1),
  type: z.enum(['ONE_TIME', 'RECURRING', 'ANNUAL_HOSTING']),
  priceCents: z.number().int().nonnegative(),
  interval: z.string().nullable().optional(),
  features: z.record(z.unknown()).optional(),
});

const patchPlanSchema = planBodySchema.partial().omit({ code: true });

@Injectable()
export class PlansService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  list() {
    return this.db.plan.findMany({ orderBy: { code: 'asc' } });
  }

  async get(id: string) {
    const plan = await this.db.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plano não encontrado' });
    }
    return plan;
  }

  async create(body: unknown, idempotencyKey?: string) {
    const parsed = planBodySchema.safeParse(body);
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

    const existing = await this.db.plan.findUnique({
      where: { code: parsed.data.code },
    });
    if (existing) {
      if (idempotencyKey && this.samePlan(existing, parsed.data)) {
        return existing;
      }
      throw new ConflictException({
        code: idempotencyKey ? 'IDEMPOTENCY_CONFLICT' : 'CONFLICT',
        message: 'Código de plano já existe',
      });
    }

    return this.db.plan.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        priceCents: parsed.data.priceCents,
        interval: parsed.data.interval ?? null,
        features: (parsed.data.features ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async patch(id: string, body: unknown) {
    await this.get(id);
    const parsed = patchPlanSchema.safeParse(body);
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
    return this.db.plan.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.priceCents !== undefined
          ? { priceCents: parsed.data.priceCents }
          : {}),
        ...(parsed.data.interval !== undefined ? { interval: parsed.data.interval } : {}),
        ...(parsed.data.features !== undefined
          ? { features: parsed.data.features as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  private samePlan(
    existing: { name: string; type: string; priceCents: number; interval: string | null },
    input: z.infer<typeof planBodySchema>,
  ): boolean {
    return (
      existing.name === input.name &&
      existing.type === input.type &&
      existing.priceCents === input.priceCents &&
      (existing.interval ?? null) === (input.interval ?? null)
    );
  }
}
