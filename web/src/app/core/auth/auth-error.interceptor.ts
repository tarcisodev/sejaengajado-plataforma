import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

let redirecting401 = false;

/**
 * 401 → /entrar (uma vez, sem loop).
 * 403 → toast com message; não redireciona.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || !isNestApiUrl(req.url)) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        if (!redirecting401 && !router.url.startsWith('/entrar')) {
          redirecting401 = true;
          void auth.signOut().finally(() => {
            redirecting401 = false;
          });
        }
        return throwError(() => error);
      }

      if (error.status === 403) {
        const message =
          (error.error as { message?: string } | null)?.message ??
          'Você não tem permissão para esta ação.';
        toast.error(message);
        return throwError(() => error);
      }

      return throwError(() => error);
    }),
  );
};

/** Test helper — reset one-shot 401 guard between specs. */
export function resetAuthErrorInterceptorState(): void {
  redirecting401 = false;
}

function isNestApiUrl(url: string): boolean {
  return (
    url.includes('/api') ||
    /\/(admin|reseller|billing|auth|public)\b/.test(url)
  );
}
