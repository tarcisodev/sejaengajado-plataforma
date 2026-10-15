import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { runWithTenant } from './tenant.context';
import type { TenantActor } from './tenant.types';

/**
 * Rebinds the request tenant actor into AsyncLocalStorage for the Nest
 * handler chain. Guards' `enterWith` alone is dropped across Nest boundaries.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const actor = context.switchToHttp().getRequest<{ tenantActor?: TenantActor }>()
      .tenantActor;
    if (!actor?.resellerId || actor.role === 'ADMIN') {
      return next.handle();
    }

    return new Observable((subscriber) => {
      const subscription = runWithTenant(actor, () =>
        next.handle().subscribe({
          next: (value) => {
            runWithTenant(actor, () => subscriber.next(value));
          },
          error: (err) => {
            runWithTenant(actor, () => subscriber.error(err));
          },
          complete: () => {
            runWithTenant(actor, () => subscriber.complete());
          },
        }),
      );
      return () => subscription.unsubscribe();
    });
  }
}
