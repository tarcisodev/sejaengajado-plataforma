import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, type Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { runWithAuthUser } from '../auth/auth.context';
import type { AuthUser } from '../auth/auth-user';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { UserRole } from '../common/roles';
import { AuditService } from './audit.service';

export const AUDIT_META = 'auditMeta';

export interface AuditMeta {
  action: string;
  entity: string;
  entityId?: (result: unknown, req: { params: Record<string, string> }) => string;
}

export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META, meta);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_META, [
      context.getHandler(),
      context.getClass(),
    ]);
    const adminOnly = !!roles?.length && roles.every((role) => role === 'ADMIN');
    if (!adminOnly && !meta) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      user?: AuthUser;
      method: string;
      path: string;
      params: Record<string, string>;
      body?: unknown;
      ip?: string;
      headers: { 'x-forwarded-for'?: string };
    }>();

    return next.handle().pipe(
      switchMap((result) =>
        from(
          (async () => {
            if (!req.user || req.method === 'GET' || req.method === 'HEAD') {
              return result;
            }
            const action = meta?.action ?? `${req.method.toLowerCase()}:${req.path}`;
            const entity = meta?.entity ?? 'Unknown';
            const entityId =
              meta?.entityId?.(result, req) ??
              req.params.id ??
              (typeof result === 'object' &&
              result &&
              'id' in result &&
              typeof (result as { id: unknown }).id === 'string'
                ? (result as { id: string }).id
                : 'n/a');
            const ip =
              req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.ip ?? null;
            await runWithAuthUser(req.user, () =>
              this.audit.record({
                actorId: req.user!.id,
                role: req.user!.role,
                action,
                entity,
                entityId,
                diff: {
                  body: req.body ?? {},
                  result: typeof result === 'object' && result ? result : {},
                },
                ip,
              }),
            );
            return result;
          })(),
        ),
      ),
    );
  }
}
