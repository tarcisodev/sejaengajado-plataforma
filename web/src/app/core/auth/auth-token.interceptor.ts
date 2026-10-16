import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';

import { accessTokenFromSupabase } from './supabase-browser';

/** Attaches Supabase access token to Nest API calls when a session exists. */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isNestApiUrl(req.url)) {
    return next(req);
  }
  return from(accessTokenFromSupabase()).pipe(
    switchMap((token) => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        }),
      );
    }),
  );
};

function isNestApiUrl(url: string): boolean {
  return url.includes('/api') || /\/(admin|reseller|billing|auth|public)\b/.test(url);
}
