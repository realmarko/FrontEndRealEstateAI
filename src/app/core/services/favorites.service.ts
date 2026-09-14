import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Listing } from '../models/listing.model';
import { ListingDto, fromDto } from './listing-api.adapter';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

interface FavoriteDto {
  id: string;
  createdAt: string;
  listing: ListingDto;
}

// Superseded by the real backend below — deleted here so a returning user's browser doesn't
// keep this dead data around indefinitely.
const LEGACY_FAVORITES_KEY_PREFIX = 'reapp_favorites_';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notification = inject(NotificationService);
  private readonly apiUrl = `${environment.apiUrl}/favorites`;

  private readonly favoriteIdsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly favoriteListingsSignal = signal<Listing[]>([]);
  // Prevents a double-click (or a click that lands while a previous toggle on the same
  // listing is still in flight) from firing two overlapping POST/DELETE requests that could
  // resolve out of order and leave the displayed state depending on network timing instead of
  // the user's actual last click.
  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());

  readonly favoriteIds = this.favoriteIdsSignal.asReadonly();
  readonly favoriteListings = this.favoriteListingsSignal.asReadonly();
  readonly count = computed(() => this.favoriteIdsSignal().size);

  constructor() {
    this.clearLegacyLocalStorage();

    // Re-fetch whenever the logged-in user changes (including logging out, which clears both
    // signals below since the API call is skipped entirely for a signed-out visitor).
    effect(() => {
      this.auth.currentUser();
      this.refresh();
    });
  }

  refresh(): void {
    if (!this.auth.isAuthenticated()) {
      this.favoriteIdsSignal.set(new Set());
      this.favoriteListingsSignal.set([]);
      return;
    }

    this.http.get<FavoriteDto[]>(this.apiUrl).subscribe({
      next: (dtos) => {
        const listings = dtos.map((d) => fromDto(d.listing));
        this.favoriteListingsSignal.set(listings);
        this.favoriteIdsSignal.set(new Set(listings.map((l) => l.id)));
      },
      // Best-effort: leave whatever was last successfully loaded rather than clearing it out
      // from under the user on a transient failure.
      error: () => {}
    });
  }

  isFavorite(listingId: string): boolean {
    return this.favoriteIdsSignal().has(listingId);
  }

  toggle(listingId: string): void {
    if (!this.auth.isAuthenticated()) {
      this.notification.error('favorites.loginRequired');
      return;
    }
    if (this.pendingIds().has(listingId)) return;

    const wasFavorite = this.isFavorite(listingId);

    // Optimistic: every consumer (reactive template bindings, and the map view's manually
    // DOM-synced marker popup, which reads isFavorite() again immediately after calling this)
    // needs the new state right away rather than waiting on the round trip.
    this.setFavoriteId(listingId, !wasFavorite);
    this.pendingIds.update((ids) => new Set(ids).add(listingId));

    const request = wasFavorite
      ? this.http.delete<void>(`${this.apiUrl}/${listingId}`)
      : this.http.post<void>(`${this.apiUrl}/${listingId}`, {});

    request.subscribe({
      next: () => {
        this.pendingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(listingId);
          return next;
        });
        // Removing is already fully reflected by the optimistic update above — no need to
        // round-trip the whole list just to confirm one id is gone. Adding still needs a
        // fetch: the newly-favorited listing's full data isn't available locally (toggle only
        // ever receives a listingId, not the Listing object, from any of its callers).
        if (wasFavorite) {
          this.favoriteListingsSignal.update((list) => list.filter((l) => l.id !== listingId));
        } else {
          this.refresh();
        }
      },
      error: () => {
        this.pendingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(listingId);
          return next;
        });
        // Re-check auth: if the session ended while this request was in flight, refresh()
        // (triggered by the login-state effect) has already cleared both signals for the
        // signed-out visitor — re-applying the rollback here would resurrect a phantom
        // favorite that toggle() itself would refuse to let a signed-out user create.
        if (this.auth.isAuthenticated()) {
          this.setFavoriteId(listingId, wasFavorite);
        }
        this.notification.error('favorites.toggleError');
      }
    });
  }

  private setFavoriteId(listingId: string, isFavorite: boolean): void {
    this.favoriteIdsSignal.update((ids) => {
      const next = new Set(ids);
      if (isFavorite) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  }

  private clearLegacyLocalStorage(): void {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_FAVORITES_KEY_PREFIX)) localStorage.removeItem(key);
    }
  }
}
