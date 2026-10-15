import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LedgerCategory, LedgerType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { decodeTimeIdCursor, encodeTimeIdCursor, paginate } from '../common/cursor';
import { PRISMA, type TenantPrisma } from '../tenant/prisma.module';
import { requireTenantResellerId } from '../tenant/tenant.context';

const manualEntrySchema = z.object({
  type: z.enum(['IN', 'OUT']),
  amountCents: z.number().int().positive(),
  refType: z.string().min(1).optional(),
  refId: z.string().min(1).optional(),
});

export interface AppendLedgerInput {
  type: LedgerType;
  category: LedgerCategory;
  amountCents: number;
  refType?: string | null;
  refId?: string | null;
  reversalOfId?: string | null;
}

function signedCents(type: LedgerType, amountCents: number): number {
  return type === 'IN' ? amountCents : -amountCents;
}

function oppositeType(type: LedgerType): LedgerType {
  return type === 'IN' ? 'OUT' : 'IN';
}

@Injectable()
export class LedgerService {
  constructor(@Inject(PRISMA) private readonly db: TenantPrisma) {}

  async append(input: AppendLedgerInput) {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Dados inválidos',
        fields: [
          {
            path: 'amountCents',
            code: 'too_small',
            message: 'Valor deve ser positivo',
          },
        ],
      });
    }

    return this.db.ledgerEntry.create({
      data: {
        resellerId: requireTenantResellerId(),
        type: input.type,
        category: input.category,
        amountCents: input.amountCents,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        reversalOfId: input.reversalOfId ?? null,
      },
    });
  }

  async appendManual(body: unknown) {
    const parsed = manualEntrySchema.safeParse(body);
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
    return this.append({
      type: parsed.data.type,
      category: 'MANUAL',
      amountCents: parsed.data.amountCents,
      refType: parsed.data.refType,
      refId: parsed.data.refId,
    });
  }

  async reverse(entryId: string) {
    const original = await this.db.ledgerEntry.findUnique({ where: { id: entryId } });
    if (!original) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lançamento não encontrado' });
    }
    if (original.category === 'REVERSAL') {
      throw new ConflictException({
        code: 'ALREADY_REVERSED',
        message: 'Este lançamento já é um estorno',
      });
    }

    const existing = await this.db.ledgerEntry.findFirst({
      where: { reversalOfId: entryId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_REVERSED',
        message: 'Lançamento já estornado',
      });
    }

    try {
      return await this.append({
        type: oppositeType(original.type),
        category: 'REVERSAL',
        amountCents: original.amountCents,
        refType: original.refType,
        refId: original.refId,
        reversalOfId: original.id,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'ALREADY_REVERSED',
          message: 'Lançamento já estornado',
        });
      }
      throw error;
    }
  }

  /** Saldo derivado: Σ IN − Σ OUT (até `at`, inclusivo). */
  async balance(at?: Date): Promise<number> {
    const groups = await this.db.ledgerEntry.groupBy({
      by: ['type'],
      where: at ? { createdAt: { lte: at } } : undefined,
      _sum: { amountCents: true },
    });

    let total = 0;
    for (const group of groups) {
      const sum = group._sum.amountCents ?? 0;
      total += signedCents(group.type, sum);
    }
    return total;
  }

  async statement(options: {
    from?: Date;
    to?: Date;
    cursor?: string;
    limit?: number;
  } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const from = options.from;
    const to = options.to;

    const openingCents = from
      ? await this.balanceBefore(from)
      : 0;
    const closingCents = to
      ? await this.balance(to)
      : await this.balance();

    const cursor = options.cursor ? decodeTimeIdCursor(options.cursor) : null;
    const rows = await this.db.ledgerEntry.findMany({
      where: {
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
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
    });

    const page = paginate(rows, limit, (row) =>
      encodeTimeIdCursor(row.createdAt, row.id),
    );

    return {
      items: page.items,
      nextCursor: page.nextCursor,
      openingCents,
      closingCents,
    };
  }

  private async balanceBefore(from: Date): Promise<number> {
    const groups = await this.db.ledgerEntry.groupBy({
      by: ['type'],
      where: { createdAt: { lt: from } },
      _sum: { amountCents: true },
    });
    let total = 0;
    for (const group of groups) {
      const sum = group._sum.amountCents ?? 0;
      total += signedCents(group.type, sum);
    }
    return total;
  }
}
