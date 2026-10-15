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
 * Auth (B4) will populate `req.tenantActor` from the DB; until then, tests set it.
 * Cross-tenant access surfaces as 404 (P12), never as a tenant leak.
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ tenantActor?: TenantActor }>();
    const actor = req.tenantActor;
    if (!actor) {
      return true;
    }
    if (actor.role !== 'ADMIN' && !actor.resellerId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Recurso não encontrado',
      });
    }
    enterTenant(actor);
    return true;
  }
}
