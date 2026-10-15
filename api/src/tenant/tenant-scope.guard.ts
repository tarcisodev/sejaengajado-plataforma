import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { enterTenant } from './tenant.context';
import type { TenantActor } from './tenant.types';

declare module 'express-serve-static-core' {
  interface Request {
    tenantActor?: TenantActor;
  }
}

/**
 * Enters the request's tenant actor into AsyncLocalStorage.
 * `SupabaseJwtGuard` populates `req.tenantActor` from the DB (role/resellerId),
 * never from JWT claims. Cross-tenant access surfaces as 404 (P12).
 * ADMIN without resellerId skips ALS and must use ADMIN_PRISMA (se_admin).
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ tenantActor?: TenantActor }>();
    const actor = req.tenantActor;
    if (!actor) {
      return true;
    }
    if (actor.role === 'ADMIN') {
      return true;
    }
    if (!actor.resellerId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Recurso não encontrado',
      });
    }
    enterTenant(actor);
    return true;
  }
}
