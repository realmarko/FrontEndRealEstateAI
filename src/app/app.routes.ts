import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'listings' },
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
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/agents/agent-signup/agent-signup.component').then(
        (m) => m.AgentSignupComponent
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/messages/messages.component').then((m) => m.MessagesComponent)
  },
  { path: '**', redirectTo: 'listings' }
];
