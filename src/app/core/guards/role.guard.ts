import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/user.model';
import { AuthService } from '../services/auth.service';

/** Redirects away unless the logged-in user has the given role. Pair with authGuard first. */
export function roleGuard(role: UserRole, redirectTo = '/listings'): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.currentUser()?.roles.includes(role)) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}
