import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../common/roles';
import type { AuthUser } from './auth-user';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Sem permissão',
      });
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Sem permissão',
      });
    }

    // Rotas só de ADMIN exigem aal2 (TOTP). /auth/me aceita vários papéis e não bloqueia.
    const adminOnlyRoute = roles.every((role) => role === 'ADMIN');
    if (adminOnlyRoute && user.aal !== 'aal2') {
      throw new ForbiddenException({
        code: 'AUTH_MFA_REQUIRED',
        message: 'MFA do admin obrigatório',
      });
    }

    return true;
  }
}
