import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
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

  // Exposed so /favorites can render its own loading/error states — refresh() previously
  // swallowed a failed fetch entirely (error: () => {}), leaving a visitor whose list failed to
  // load looking at the same "no favorites yet" empty state as someone who genuinely has none.
  readonly loading = signal(false);
  readonly loadError = signal(false);
  // Bumped on every refresh() call and captured per-request — the login-state effect below can
  // fire refresh() again (e.g. a fast logout-then-login) before an earlier call's HTTP response
  // arrives; without this, that stale response's next/error handler could overwrite signals set
  // by a newer, already-resolved call with an unrelated (or wrong-user's) result.
  private refreshSequence = 0;

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
    const sequence = ++this.refreshSequence;

    if (!this.auth.isAuthenticated()) {
      this.favoriteIdsSignal.set(new Set());
      this.favoriteListingsSignal.set([]);
      this.loadError.set(false);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(false);
    this.http
      .get<FavoriteDto[]>(this.apiUrl)
      .pipe(finalize(() => { if (sequence === this.refreshSequence) this.loading.set(false); }))
      .subscribe({
        next: (dtos) => {
          // A newer refresh() (e.g. a fast logout-then-login re-triggering the auth-change
          // effect) may have already started — its own result, not this now-stale one, should
          // win, whether this one is about to succeed or fail.
          if (sequence !== this.refreshSequence) return;
          const listings = dtos.map((d) => fromDto(d.listing));
          this.favoriteListingsSignal.set(listings);
          this.favoriteIdsSignal.set(new Set(listings.map((l) => l.id)));
        },
        // Data is left as whatever was last successfully loaded (not cleared) on a transient
        // failure — loadError still flips so /favorites can show a real error state instead of
        // silently looking identical to "you have no favorites".
        error: () => {
          if (sequence === this.refreshSequence) this.loadError.set(true);
        }
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
