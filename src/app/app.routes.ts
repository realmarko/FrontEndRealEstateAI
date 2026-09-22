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
    path: 'favorites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/favorites/favorites.component').then((m) => m.FavoritesComponent)
  },
  {
    path: 'messages',
    // Only Owner-role accounts (which Agent accounts also get) can receive inquiries — matches
    // InquiriesController.Received's [Authorize(Roles = "Owner")], so a Buyer-only account
    // never hits a 403 here instead of a real page.
    canActivate: [authGuard, roleGuard('Owner')],
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
  { path: '**', redirectTo: 'listings' }
];
