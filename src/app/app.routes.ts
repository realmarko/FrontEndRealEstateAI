import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { hasCoordinatesGuard } from './core/guards/has-coordinates.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy/privacy.component').then((m) => m.PrivacyComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms/terms.component').then((m) => m.TermsComponent)
  },
  {
    path: 'listings',
    loadComponent: () =>
      import('./features/listings/listing-list/listing-list.component').then(
        (m) => m.ListingListComponent
      )
  },
  {
    path: 'listings/new',
    canActivate: [authGuard, hasCoordinatesGuard],
    loadComponent: () =>
      import('./features/listings/listing-form/listing-form.component').then(
        (m) => m.ListingFormComponent
      )
  },
  {
    path: 'listings/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/listings/listing-form/listing-form.component').then(
        (m) => m.ListingFormComponent
      )
  },
  {
    path: 'listings/:id',
    loadComponent: () =>
      import('./features/listings/listing-detail/listing-detail.component').then(
        (m) => m.ListingDetailComponent
      )
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./features/map-view/map-view.component').then((m) => m.MapViewComponent)
  },
  {
    path: 'agents',
    loadComponent: () =>
      import('./features/agents/agents-list/agents-list.component').then(
        (m) => m.AgentsListComponent
      )
  },
  {
    path: 'agents/new',
    canActivate: [authGuard, roleGuard('Agent')],
    loadComponent: () =>
      import('./features/agents/agent-signup/agent-signup.component').then(
        (m) => m.AgentSignupComponent
      )
  },
  {
    path: 'agents/edit',
    canActivate: [authGuard, roleGuard('Agent')],
    data: { editMode: true },
    loadComponent: () =>
      import('./features/agents/agent-signup/agent-signup.component').then(
        (m) => m.AgentSignupComponent
      )
  },
  {
    path: 'agents/:id',
    loadComponent: () =>
      import('./features/agents/agent-detail/agent-detail.component').then(
        (m) => m.AgentDetailComponent
      )
  },
  {
    path: 'owners',
    loadComponent: () =>
      import('./features/owners/owners-list/owners-list.component').then(
        (m) => m.OwnersListComponent
      )
  },
  {
    path: 'owners/new',
    canActivate: [authGuard, roleGuard('Owner')],
    loadComponent: () =>
      import('./features/owners/owner-signup/owner-signup.component').then(
        (m) => m.OwnerSignupComponent
      )
  },
  {
    path: 'owners/edit',
    canActivate: [authGuard, roleGuard('Owner')],
    data: { editMode: true },
    loadComponent: () =>
      import('./features/owners/owner-signup/owner-signup.component').then(
        (m) => m.OwnerSignupComponent
      )
  },
  {
    path: 'owners/:id',
    loadComponent: () =>
      import('./features/owners/owner-detail/owner-detail.component').then(
        (m) => m.OwnerDetailComponent
      )
  },
  {
    path: 'inmobiliarias',
    loadComponent: () =>
      import('./features/agencies/agencies-list/agencies-list.component').then(
        (m) => m.AgenciesListComponent
      )
  },
  {
    path: 'inmobiliarias/edit',
    canActivate: [authGuard, roleGuard('Agent')],
    loadComponent: () =>
      import('./features/agencies/agency-edit/agency-edit.component').then(
        (m) => m.AgencyEditComponent
      )
  },
  {
    // Reached from the map's "Agregar inmobiliaria" tool — same ?lat&lng contract as
    // 'listings/new', must stay above 'inmobiliarias/:id' or ':id' would greedily match "new".
    path: 'inmobiliarias/new',
    canActivate: [authGuard, roleGuard('Admin'), hasCoordinatesGuard],
    loadComponent: () =>
      import('./features/agencies/agency-create/agency-create.component').then(
        (m) => m.AgencyCreateComponent
      )
  },
  {
    path: 'inmobiliarias/:id',
    loadComponent: () =>
      import('./features/agencies/agency-detail/agency-detail.component').then(
        (m) => m.AgencyDetailComponent
      )
  },
  {
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/favorites/favorites.component').then((m) => m.FavoritesComponent)
  },
  {
    // No authGuard: ComparisonService's selection is anonymous-friendly (localStorage-backed,
    // no account needed), so the page itself shouldn't require signing in either.
    path: 'comparar',
    loadComponent: () =>
      import('./features/listings/listing-comparison/listing-comparison.component').then(
        (m) => m.ListingComparisonComponent
      )
  },
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
  {
    path: 'fraccionamientos',
    loadComponent: () =>
      import('./features/fraccionamientos/fraccionamientos-list/fraccionamientos-list.component').then(
        (m) => m.FraccionamientosListComponent
      )
  },
  {
    path: 'fraccionamientos/:id',
    loadComponent: () =>
      import('./features/fraccionamientos/fraccionamientos-detail/fraccionamientos-detail.component').then(
        (m) => m.FraccionamientosDetailComponent
      )
  },
  {
    // Admin-only (matches SaleProcessesController's own [Authorize(Roles = "Admin")]) — each
    // admin sees/manages their own pipeline, not a cross-agent view of every agent's deals.
    path: 'pipeline',
    canActivate: [authGuard, roleGuard('Admin')],
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
    path: 'admin/inmobiliarias',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-agencies/admin-agencies.component').then(
        (m) => m.AdminAgenciesComponent
      )
  },
  {
    // Admin-only edit for any brokerage by id — distinct from 'inmobiliarias/edit' above, which
    // only a member agent can use on their own brokerage.
    path: 'admin/inmobiliarias/:id/edit',
    canActivate: [authGuard, roleGuard('Admin')],
    loadComponent: () =>
      import('./features/admin/admin-agency-edit/admin-agency-edit.component').then(
        (m) => m.AdminAgencyEditComponent
      )
  },
  { path: '**', redirectTo: 'listings' }
];
