import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductCode } from '@prisma/client';
import { z } from 'zod';

import { ADMIN_PRISMA, type AdminPrisma } from '../../tenant/prisma.module';

const patchProductSchema = z.object({
  name: z.string().min(1).optional(),
  baseWholesaleCents: z.number().int().nonnegative().optional(),
});

@Injectable()
export class ProductsService {
  constructor(@Inject(ADMIN_PRISMA) private readonly db: AdminPrisma) {}

  list() {
    return this.db.product.findMany({ orderBy: { code: 'asc' } });
  }

  async get(id: string) {
    const row = await this.db.product.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Não encontrado' });
    }
    return row;
  }

  async getByCode(code: ProductCode) {
    const row = await this.db.product.findUnique({ where: { code } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Não encontrado' });
    }
    return row;
  }

  async patch(id: string, body: unknown) {
    await this.get(id);
    const parsed = patchProductSchema.safeParse(body);
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
    return this.db.product.update({
      where: { id },
      data: parsed.data,
    });
  }
}
