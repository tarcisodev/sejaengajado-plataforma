import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';

import { ENV, supabaseIssuer, type Env } from '../config/env';
import { ADMIN_PRISMA, type AdminPrisma } from '../tenant/prisma.module';
import type { TenantActor } from '../tenant/tenant.types';
import type { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './public.decorator';

type AuthedRequest = {
  headers: { authorization?: string };
  user?: AuthUser;
  tenantActor?: TenantActor;
};

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
    @Inject(ADMIN_PRISMA) private readonly adminPrisma: AdminPrisma,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Não autenticado',
      });
    }

    let sub: string;
    let aal: 'aal1' | 'aal2' = 'aal1';
    try {
      const secret = new TextEncoder().encode(this.env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        issuer: supabaseIssuer(this.env.SUPABASE_URL),
        audience: this.env.SUPABASE_JWT_AUD,
      });
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('missing sub');
      }
      sub = payload.sub;
      if (payload.aal === 'aal2' || payload.aal === 'aal1') {
        aal = payload.aal;
      }
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Não autenticado',
      });
    }

    const user = await this.adminPrisma.user.findUnique({
      where: { supabaseId: sub },
    });
    if (!user) {
      throw new ForbiddenException({
        code: 'AUTH_NOT_INVITED',
        message: 'Usuário não convidado',
      });
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Usuário inativo',
      });
    }

    const authUser: AuthUser = {
      id: user.id,
      supabaseId: user.supabaseId,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
      status: user.status,
      aal,
    };
    req.user = authUser;
    req.tenantActor = {
      userId: authUser.id,
      role: authUser.role,
      resellerId: authUser.resellerId,
    };
    return true;
  }
}

function bearerToken(header?: string): string | undefined {
  if (!header) {
    return undefined;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token;
}
