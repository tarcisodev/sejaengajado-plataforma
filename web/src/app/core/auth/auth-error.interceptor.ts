import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { ensureSupabaseBrowser } from './supabase-browser';

/** Marks a request that already retried after a single shared refreshSession. */
export const AUTH_RETRIED = new HttpContextToken(() => false);

let redirecting401 = false;
let sharedRefresh: Promise<boolean> | null = null;

/**
 * 401 → refreshSession uma vez (concorrente compartilha) → retry; se falhar → /entrar.
 * 403 / 404 → toast com message; não redireciona.
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
        if (req.context.get(AUTH_RETRIED)) {
          return logoutOn401(auth, router, error);
        }
        if (!sharedRefresh) {
          sharedRefresh = refreshSessionOnce().finally(() => {
            sharedRefresh = null;
          });
        }
        return from(sharedRefresh).pipe(
          switchMap((ok) => {
            if (!ok) {
              return logoutOn401(auth, router, error);
            }
            return next(req.clone({ context: req.context.set(AUTH_RETRIED, true) }));
          }),
          catchError((retryError: unknown) => {
            if (
              retryError instanceof HttpErrorResponse &&
              retryError.status === 401 &&
              isNestApiUrl(req.url)
            ) {
              return logoutOn401(auth, router, retryError);
            }
            return throwError(() => retryError);
          }),
        );
      }

      if (error.status === 403 && isMfaRequired(error)) {
        if (!router.url.startsWith('/mfa')) {
          const returnUrl = router.url.startsWith('/') ? router.url : undefined;
          void router.navigate(['/mfa'], returnUrl ? { queryParams: { returnUrl } } : {});
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

      if (error.status === 404) {
        const message =
          (error.error as { message?: string } | null)?.message ?? 'Recurso não encontrado.';
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
  sharedRefresh = null;
}

function logoutOn401(auth: AuthService, router: Router, error: HttpErrorResponse) {
  if (!redirecting401 && !router.url.startsWith('/entrar')) {
    redirecting401 = true;
    void auth.signOut().finally(() => {
      redirecting401 = false;
    });
  }
  return throwError(() => error);
}

async function refreshSessionOnce(): Promise<boolean> {
  const sb = await ensureSupabaseBrowser();
  if (!sb) {
    return false;
  }
  const { data, error } = await sb.auth.refreshSession();
  return !error && Boolean(data.session?.access_token);
}

/** Legacy API 403 codes if a route still demands TOTP (MFA is optional by default). */
function isMfaRequired(error: HttpErrorResponse): boolean {
  const code = (error.error as { code?: string } | null)?.code;
  return code === 'MFA_REQUIRED' || code === 'AUTH_MFA_REQUIRED';
}

function isNestApiUrl(url: string): boolean {
  return url.includes('/api') || /\/(admin|reseller|billing|auth|public)\b/.test(url);
}
