import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';

import { PRISMA, type TenantPrisma } from '../../tenant/prisma.module';
import { requireTenantResellerId } from '../../tenant/tenant.context';

export const patchSelfResellerSchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().max(32).optional(),
  phone: z.string().max(32).optional(),
  addressLine: z.string().max(200).optional(),
  addressCity: z.string().max(80).optional(),
  addressUf: z.string().max(2).optional(),
  addressCep: z.string().max(16).optional(),
});

@Injectable()
export class ResellerProfileService {
  constructor(@Inject(PRISMA) private readonly db: TenantPrisma) {}

  async getMe() {
    const resellerId = requireTenantResellerId();
    const row = await this.db.reseller.findUnique({
      where: { id: resellerId },
      include: { plan: true, users: { take: 1 } },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Revendedor não encontrado' });
    }
    return row;
  }

  async patchMe(body: unknown) {
    const parsed = patchSelfResellerSchema.safeParse(body);
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
    const resellerId = requireTenantResellerId();
    return this.db.reseller.update({
      where: { id: resellerId },
      data: {
        name: parsed.data.name,
        // Profile columns from migration 20261016170000_reseller_profile
        document: parsed.data.document,
        phone: parsed.data.phone,
        addressLine: parsed.data.addressLine,
        addressCity: parsed.data.addressCity,
        addressUf: parsed.data.addressUf,
        addressCep: parsed.data.addressCep,
      } as Parameters<TenantPrisma['reseller']['update']>[0]['data'],
      include: { plan: true, users: { take: 1 } },
    });
  }
}
