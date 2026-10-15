import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

export const platformConfigSchema = z
  .object({
    warningDays: z.number().int().positive(),
    readOnlyDays: z.number().int().positive(),
    suspendDays: z.number().int().positive(),
    archiveDays: z.number().int().positive(),
    resellerGraceDays: z.literal(30),
    prontoRenewalCents: z.number().int().nonnegative(),
    plaqueValueCents: z.number().int().nonnegative(),
    plaquePenaltyPct: z.number().int().min(0).max(100),
  })
  .superRefine((data, ctx) => {
    if (!(data.warningDays < data.readOnlyDays)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['readOnlyDays'],
        message: 'Deve ser maior que warningDays',
      });
    }
    if (!(data.readOnlyDays < data.suspendDays)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['suspendDays'],
        message: 'Deve ser maior que readOnlyDays',
      });
    }
    if (!(data.suspendDays < data.archiveDays)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['archiveDays'],
        message: 'Deve ser maior que suspendDays',
      });
    }
    // Canonical defaults from seed / PRODUCAO-02
    if (data.warningDays !== 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['warningDays'],
        message: 'Deve ser 7',
      });
    }
    if (data.readOnlyDays !== 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['readOnlyDays'],
        message: 'Deve ser 8',
      });
    }
    if (data.suspendDays !== 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['suspendDays'],
        message: 'Deve ser 16',
      });
    }
    if (data.archiveDays !== 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['archiveDays'],
        message: 'Deve ser 60',
      });
    }
  });

@Injectable()
export class PlatformConfigService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  async get() {
    const row = await this.db.platformConfig.findUnique({ where: { id: 'default' } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Config não encontrada' });
    }
    return row;
  }

  async put(body: unknown) {
    const parsed = platformConfigSchema.safeParse(body);
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

    return this.db.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...parsed.data },
      update: parsed.data,
    });
  }
}
