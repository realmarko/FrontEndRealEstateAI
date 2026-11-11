import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { hasCoordinatesGuard } from './core/guards/has-coordinates.guard';
import { roleGuard } from './core/guards/role.guard';
import { pairRoutes } from './core/routing/localized-route';
import { slugFor } from './core/routing/route-slugs';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent)
  },
  ...pairRoutes('forAgents', '', {
    loadComponent: () =>
      import('./features/landing/for-agents/for-agents-landing.component').then(
        (m) => m.ForAgentsLandingComponent
      )
  }),
  ...pairRoutes('login', '', {
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  }),
  ...pairRoutes('register', '', {
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
  }),
  ...pairRoutes('forgotPassword', '', {
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  }),
  ...pairRoutes('resetPassword', '', {
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  }),
  ...pairRoutes('verifyEmail', '', {
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent)
  }),
  ...pairRoutes('privacy', '', {
    loadComponent: () => import('./features/legal/privacy/privacy.component').then((m) => m.PrivacyComponent)
  }),
  ...pairRoutes('terms', '', {
    loadComponent: () => import('./features/legal/terms/terms.component').then((m) => m.TermsComponent)
  }),
  ...pairRoutes('listings', '', {
    loadComponent: () =>
      import('./features/listings/listing-list/listing-list.component').then(
        (m) => m.ListingListComponent
      )
  }),
  ...pairRoutes('listings', 'new', {
    canActivate: [authGuard, hasCoordinatesGuard],
    loadComponent: () =>
      import('./features/listings/listing-form/listing-form.component').then(
        (m) => m.ListingFormComponent
      )
  }),
  ...pairRoutes('listings', ':id/edit', {
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/listings/listing-form/listing-form.component').then(
        (m) => m.ListingFormComponent
      )
  }),
  {
    // Deferred from the EN/ES slug pass (see route-slugs.ts) — low-traffic sub-page, kept as a
    // single untouched path for now.
    path: 'listings/:id/viabilidad-comercial',
    loadComponent: () =>
      import('./features/listings/viability-report-page/viability-report-page.component').then(
        (m) => m.ViabilityReportPageComponent
      )
  },
  {
    // Same deferral as viabilidad-comercial above — single untouched path, not part of the
    // EN/ES slug pass.
    path: 'listings/:id/analisis-residencial',
    loadComponent: () =>
      import('./features/listings/residential-analysis-page/residential-analysis-page.component').then(
        (m) => m.ResidentialAnalysisPageComponent
      )
  },
  ...pairRoutes('listings', ':id', {
    loadComponent: () =>
      import('./features/listings/listing-detail/listing-detail.component').then(
        (m) => m.ListingDetailComponent
      )
  }),
  ...pairRoutes('map', '', {
    loadComponent: () =>
      import('./features/map-view/map-view.component').then((m) => m.MapViewComponent)
  }),
  ...pairRoutes('agents', '', {
    loadComponent: () =>
      import('./features/agents/agents-list/agents-list.component').then(
        (m) => m.AgentsListComponent
      )
  }),
  ...pairRoutes('agents', 'new', {
    canActivate: [authGuard, roleGuard('Agent')],
    loadComponent: () =>
      import('./features/agents/agent-signup/agent-signup.component').then(
        (m) => m.AgentSignupComponent
      )
  }),
  ...pairRoutes('agents', 'edit', {
    canActivate: [authGuard, roleGuard('Agent')],
    data: { editMode: true },
    loadComponent: () =>
      import('./features/agents/agent-signup/agent-signup.component').then(
        (m) => m.AgentSignupComponent
      )
  }),
  ...pairRoutes('agents', ':id', {
    loadComponent: () =>
      import('./features/agents/agent-detail/agent-detail.component').then(
        (m) => m.AgentDetailComponent
      )
  }),
  ...pairRoutes('owners', '', {
    loadComponent: () =>
      import('./features/owners/owners-list/owners-list.component').then(
        (m) => m.OwnersListComponent
      )
  }),
  ...pairRoutes('owners', 'new', {
    canActivate: [authGuard, roleGuard('Owner')],
    loadComponent: () =>
      import('./features/owners/owner-signup/owner-signup.component').then(
        (m) => m.OwnerSignupComponent
      )
  }),
  ...pairRoutes('owners', 'edit', {
    canActivate: [authGuard, roleGuard('Owner')],
    data: { editMode: true },
    loadComponent: () =>
      import('./features/owners/owner-signup/owner-signup.component').then(
        (m) => m.OwnerSignupComponent
      )
  }),
  ...pairRoutes('owners', ':id', {
    loadComponent: () =>
      import('./features/owners/owner-detail/owner-detail.component').then(
        (m) => m.OwnerDetailComponent
      )
  }),
  ...pairRoutes('agencies', '', {
    loadComponent: () =>
      import('./features/agencies/agencies-list/agencies-list.component').then(
        (m) => m.AgenciesListComponent
      )
  }),
  ...pairRoutes('agencies', 'edit', {
    canActivate: [authGuard, roleGuard('Agent')],
    loadComponent: () =>
      import('./features/agencies/agency-edit/agency-edit.component').then(
        (m) => m.AgencyEditComponent
      )
  }),
  ...pairRoutes('agencies', 'new', {
    // Reached from the map's "Agregar inmobiliaria" tool — same ?lat&lng contract as
    // '.../new' above, must stay above the ':id' pair below or ':id' would greedily match "new".
    canActivate: [authGuard, roleGuard('Admin'), hasCoordinatesGuard],
    loadComponent: () =>
      import('./features/agencies/agency-create/agency-create.component').then(
        (m) => m.AgencyCreateComponent
      )
  }),
  ...pairRoutes('agencies', ':id', {
    loadComponent: () =>
      import('./features/agencies/agency-detail/agency-detail.component').then(
        (m) => m.AgencyDetailComponent
      )
  }),
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/favorites/favorites.component').then((m) => m.FavoritesComponent)
  },
  ...pairRoutes('compare', '', {
    // No authGuard: ComparisonService's selection is anonymous-friendly (localStorage-backed,
    // no account needed), so the page itself shouldn't require signing in either.
    loadComponent: () =>
      import('./features/listings/listing-comparison/listing-comparison.component').then(
        (m) => m.ListingComparisonComponent
      )
  }),
  {
    path: 'messages',
    // Owner-role accounts (which Agent accounts also get) receive inquiries on their own
    // listings; Admin accounts additionally see every owner-contact notification regardless of
    // which listing it's on — matches InquiriesController.Received's
    // [Authorize(Roles = "Owner,Admin")], so neither a Buyer-only nor an Admin-only account ever
    // hits a 403 here instead of a real page.
    canActivate: [authGuard, roleGuard(['Owner', 'Admin'])],
    loadComponent: () =>
      import('./features/messages/messages.component').then((m) => m.MessagesComponent)
  },
  {
    path: 'saved-searches',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/saved-searches/saved-searches.component').then(
        (m) => m.SavedSearchesComponent
      )
  },
  ...pairRoutes('developments', '', {
    loadComponent: () =>
      import('./features/fraccionamientos/fraccionamientos-list/fraccionamientos-list.component').then(
        (m) => m.FraccionamientosListComponent
      )
  }),
  ...pairRoutes('developments', ':id', {
    loadComponent: () =>
      import('./features/fraccionamientos/fraccionamientos-detail/fraccionamientos-detail.component').then(
        (m) => m.FraccionamientosDetailComponent
      )
  }),
  {
    // Admin or Agent (matches SaleProcessesController's own [Authorize(Roles = "Admin,Agent")]) —
    // each caller sees/manages their own pipeline, not a cross-agent view of every agent's deals.
    path: 'pipeline',
    canActivate: [authGuard, roleGuard(['Admin', 'Agent'])],
    loadComponent: () =>
      import('./features/pipeline/pipeline-board/pipeline-board.component').then(
        (m) => m.PipelineBoardComponent
      )
  },
  {
    path: 'admin/errors',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-errors/admin-errors.component').then(
        (m) => m.AdminErrorsComponent
      )
  },
  {
    path: 'admin/fraccionamientos',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-fraccionamientos/admin-fraccionamientos.component').then(
        (m) => m.AdminFraccionamientosComponent
      )
  },
  {
    path: 'admin/infrastructure-projects',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-infrastructure-projects/admin-infrastructure-projects.component').then(
        (m) => m.AdminInfrastructureProjectsComponent
      )
  },
  {
    path: 'admin/estadisticas',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-stats/admin-stats.component').then(
        (m) => m.AdminStatsComponent
      )
  },
  {
    path: 'admin/inmobiliarias',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-agencies/admin-agencies.component').then(
        (m) => m.AdminAgenciesComponent
      )
  },
  {
    // Admin-only edit for any brokerage by id — distinct from 'agencies/edit' above, which
    // only a member agent can use on their own brokerage.
    path: 'admin/inmobiliarias/:id/edit',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-agency-edit/admin-agency-edit.component').then(
        (m) => m.AdminAgencyEditComponent
      )
  },
  // Spanish-default (see translation.service.ts) — an unmatched URL falls back to the ES listings
  // slug rather than the English one.
  { path: '**', redirectTo: slugFor('listings', 'es') }
];
