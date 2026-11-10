import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { TranslationService } from '../services/translation.service';

/** Redirects away unless the logged-in user has the given role (or, if an array is passed, at
 * least one of them). Pair with authGuard first. `redirectTo`, when given, is a literal path —
 * the default instead resolves to the CURRENT language's listings URL, computed lazily inside the
 * returned guard (not here, since roleGuard(...) itself runs once at route-definition time). */
export function roleGuard(role: UserRole | UserRole[], redirectTo?: string): CanActivateFn {
  const roles = Array.isArray(role) ? role : [role];
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const translation = inject(TranslationService);

    const userRoles = auth.currentUser()?.roles ?? [];
    if (roles.some((r) => userRoles.includes(r))) {
      return true;
    }

    return router.parseUrl(redirectTo ?? translation.path('listings'));
  };
}
