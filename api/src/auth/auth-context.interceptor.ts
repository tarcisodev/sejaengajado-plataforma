import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import type { AuthUser } from './auth-user';
import { runWithAuthUser } from './auth.context';

/**
 * Rebinds AuthUser into AsyncLocalStorage for the Nest handler/interceptor
 * chain. Guards' `enterWith` alone is not enough across Nest async boundaries.
 */
@Injectable()
export class AuthContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      const subscription = runWithAuthUser(user, () =>
        next.handle().subscribe({
          next: (value) => {
            runWithAuthUser(user, () => subscriber.next(value));
          },
          error: (err) => {
            runWithAuthUser(user, () => subscriber.error(err));
          },
          complete: () => {
            runWithAuthUser(user, () => subscriber.complete());
          },
        }),
      );
      return () => subscription.unsubscribe();
    });
  }
}
