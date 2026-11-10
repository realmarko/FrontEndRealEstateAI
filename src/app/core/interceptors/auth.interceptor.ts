import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TranslationService } from '../services/translation.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);
  const translation = inject(TranslationService);
  const token = auth.token;

  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      // A 401 from /auth/* (e.g. a wrong-password login attempt, or the refresh call below
      // itself) means "bad credentials"/"refresh token is dead", not "silently retry" — only an
      // authenticated non-auth request's 401 (an expired access token) should trigger a refresh.
      // The auth.token check guards against a page firing several authenticated requests in
      // parallel (e.g. agent-detail's profile/reviews/listings calls): once the first 401 starts
      // handling it, auth.token's later checks (here and in the failure branch below) reflect
      // that single shared attempt instead of each request racing its own.
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/auth/') && auth.token) {
        return auth.refresh().pipe(
          // catchError sits only around auth.refresh() itself, not around the retried request
          // below — a failure here means the refresh token is dead (expired, or reused/revoked),
          // which is the one path that still forces a real re-login. auth.token is checked again
          // here (not just whether refresh failed) so that when two requests 401 together and
          // share one refresh attempt, only the first to resolve actually logs out/redirects.
          catchError(() => {
            if (auth.token) {
              auth.logout();
              notification.error('auth.errors.sessionExpired');
              router.navigateByUrl(translation.path('login'));
            }
            return throwError(() => err);
          }),
          // Success: retry the original request with the freshly rotated access token — this is
          // what makes the expiry invisible to the user, Facebook-style, instead of bouncing them
          // to /login just because an hour passed. Deliberately outside the catchError above: if
          // this retry itself fails (e.g. a genuine 500, or a 403-shaped permission problem), that
          // real error should reach the caller, not get silently replaced with the original 401.
          switchMap(() => next(req.clone({ setHeaders: { Authorization: `Bearer ${auth.token}` } })))
        );
      }
      return throwError(() => err);
    })
  );
};
