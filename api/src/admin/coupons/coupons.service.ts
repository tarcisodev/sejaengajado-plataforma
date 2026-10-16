import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';
import { parseCouponDateInput } from './coupon-date';
import { applyCouponDiscount } from './coupon-discount';

const couponDateSchema = z
  .union([
    z.string().datetime({ offset: true }),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD ou datetime ISO'),
  ])
  .transform((value, ctx) => {
    try {
      return parseCouponDateInput(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inválida',
      });
      return z.NEVER;
    }
  });

export const couponBodySchema = z
  .object({
    code: z.string().min(1).max(64),
    type: z.enum(['PCT', 'FIXED']),
    value: z.number().int().nonnegative(),
    active: z.boolean().optional(),
    validFrom: couponDateSchema.nullable().optional(),
    validTo: couponDateSchema.nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PCT' && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentual deve ser entre 0 e 100',
      });
    }
  });

const previewSchema = z.object({
  code: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  at: z.string().datetime().optional(),
});

@Injectable()
export class CouponsService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  list() {
    return this.db.coupon.findMany({ orderBy: { code: 'asc' } });
  }

  async get(id: string) {
    const coupon = await this.db.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cupom não encontrado' });
    }
    return coupon;
  }

  /** Soft-delete: desativa o cupom (código permanece único). */
  async deactivate(id: string) {
    await this.get(id);
    return this.db.coupon.update({
      where: { id },
      data: { active: false },
    });
  }

  async create(body: unknown, idempotencyKey?: string) {
    const parsed = couponBodySchema.safeParse(body);
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

    const code = parsed.data.code.toUpperCase();
    const existing = await this.db.coupon.findUnique({ where: { code } });
    if (existing) {
      if (idempotencyKey && this.sameCoupon(existing, parsed.data, code)) {
        return existing;
      }
      throw new ConflictException({
        code: idempotencyKey ? 'IDEMPOTENCY_CONFLICT' : 'CONFLICT',
        message: 'Código de cupom já existe',
      });
    }

    return this.db.coupon.create({
      data: {
        code,
        type: parsed.data.type,
        value: parsed.data.value,
        active: parsed.data.active ?? true,
        validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
        validTo: parsed.data.validTo ? new Date(parsed.data.validTo) : null,
        maxUses: parsed.data.maxUses ?? null,
      },
    });
  }

  async preview(body: unknown) {
    const parsed = previewSchema.safeParse(body);
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

    const coupon = await this.db.coupon.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
    });
    if (!coupon) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cupom não encontrado' });
    }

    const result = applyCouponDiscount({
      amountCents: parsed.data.amountCents,
      type: coupon.type,
      value: coupon.value,
      active: coupon.active,
      validFrom: coupon.validFrom,
      validTo: coupon.validTo,
      maxUses: coupon.maxUses,
      usedCount: coupon.usedCount,
      at: parsed.data.at ? new Date(parsed.data.at) : undefined,
    });

    if (!result.ok) {
      throw new BadRequestException({
        code: 'COUPON_INVALID',
        message: 'Cupom inválido para este valor',
        fields: [{ path: 'code', code: result.reason, message: 'Cupom não aplicável' }],
      });
    }

    return {
      code: coupon.code,
      amountCents: parsed.data.amountCents,
      discountCents: result.discountCents,
      finalCents: result.finalCents,
    };
  }

  /**
   * Atomic redeem: advisory lock + UPDATE … WHERE used_count < max_uses.
   * Concurrent callers cannot exceed maxUses.
   */
  async redeem(body: unknown) {
    const parsed = previewSchema.safeParse(body);
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

    const code = parsed.data.code.toUpperCase();
    const at = parsed.data.at ? new Date(parsed.data.at) : new Date();

    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`coupon:${code}`}))`;

      const coupon = await tx.coupon.findUnique({ where: { code } });
      if (!coupon) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cupom não encontrado' });
      }

      const result = applyCouponDiscount({
        amountCents: parsed.data.amountCents,
        type: coupon.type,
        value: coupon.value,
        active: coupon.active,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        at,
      });
      if (!result.ok) {
        throw new ConflictException({
          code: 'COUPON_INVALID',
          message: 'Cupom inválido para este valor',
          fields: [{ path: 'code', code: result.reason, message: 'Cupom não aplicável' }],
        });
      }

      const updated = await tx.$queryRaw<{ id: string; used_count: number }[]>`
        UPDATE coupons
        SET used_count = used_count + 1, updated_at = NOW()
        WHERE id = ${coupon.id}::uuid
          AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING id, used_count
      `;
      if (updated.length === 0) {
        throw new ConflictException({
          code: 'COUPON_INVALID',
          message: 'Limite de usos do cupom atingido',
          fields: [{ path: 'code', code: 'max_uses', message: 'Cupom esgotado' }],
        });
      }

      return {
        code: coupon.code,
        amountCents: parsed.data.amountCents,
        discountCents: result.discountCents,
        finalCents: result.finalCents,
        usedCount: updated[0]!.used_count,
      };
    });
  }

  private sameCoupon(
    existing: {
      code: string;
      type: string;
      value: number;
      active: boolean;
      maxUses: number | null;
    },
    input: z.infer<typeof couponBodySchema>,
    code: string,
  ): boolean {
    return (
      existing.code === code &&
      existing.type === input.type &&
      existing.value === input.value &&
      existing.active === (input.active ?? true) &&
      (existing.maxUses ?? null) === (input.maxUses ?? null)
    );
  }
}
