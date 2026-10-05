import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);
  const token = auth.token;

  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      // A 401 from /auth/* (e.g. a wrong-password login attempt) means "bad credentials", not
      // "your session expired" — those screens already show their own message, so only an
      // authenticated request's 401 (an expired/invalid token) should force a logout here.
      // The auth.token check guards against a page firing several authenticated requests in
      // parallel (e.g. agent-detail's profile/reviews/listings calls): once the first 401 logs
      // out, auth.token is already null, so the rest skip the duplicate toast/redirect instead
      // of each independently repeating it.
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.includes('/auth/') && auth.token) {
        auth.logout();
        notification.error('auth.errors.sessionExpired');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
