import { ForbiddenException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

import { AdminPrismaForbiddenError, requireAdminPrismaAccess } from '../auth/auth.context';

const MODEL_DELEGATES = new Set(
  Prisma.dmmf.datamodel.models.map(
    (model) => model.name.charAt(0).toLowerCase() + model.name.slice(1),
  ),
);

/**
 * Proxy over the se_admin client: model access is allowed only when the
 * current AsyncLocalStorage user is ADMIN with aal2.
 */
export function createAdminPrismaProxy(root: PrismaClient): PrismaClient {
  return new Proxy(root, {
    get(target, prop) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, target);
      }
      if (prop === 'then' || prop === 'toJSON') {
        return undefined;
      }
      if (typeof prop === 'string' && MODEL_DELEGATES.has(prop)) {
        try {
          requireAdminPrismaAccess();
        } catch (error) {
          if (error instanceof AdminPrismaForbiddenError) {
            throw new ForbiddenException({
              code: 'ADMIN_PRISMA_FORBIDDEN',
              message: 'Conexão admin indisponível nesta rota',
            });
          }
          throw error;
        }
        return Reflect.get(target, prop, target);
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as PrismaClient;
}
