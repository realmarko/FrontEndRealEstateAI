import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/user.model';
import { AuthService } from '../services/auth.service';

/** Redirects away unless the logged-in user has the given role (or, if an array is passed, at
 * least one of them). Pair with authGuard first. */
export function roleGuard(role: UserRole | UserRole[], redirectTo = '/listings'): CanActivateFn {
  const roles = Array.isArray(role) ? role : [role];
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const userRoles = auth.currentUser()?.roles ?? [];
    if (roles.some((r) => userRoles.includes(r))) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}
