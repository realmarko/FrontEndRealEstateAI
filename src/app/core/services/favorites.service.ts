import { Injectable, computed, effect, signal } from '@angular/core';
import { AuthService } from './auth.service';

const FAVORITES_KEY_PREFIX = 'reapp_favorites_';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly favoriteIdsSignal = signal<string[]>([]);

  readonly favoriteIds = this.favoriteIdsSignal.asReadonly();
  readonly count = computed(() => this.favoriteIdsSignal().length);

  constructor(private readonly auth: AuthService) {
    effect(() => {
      this.auth.currentUser();
      this.favoriteIdsSignal.set(this.readFavorites());
    });
  }

  isFavorite(listingId: string): boolean {
    return this.favoriteIdsSignal().includes(listingId);
  }

  toggle(listingId: string): void {
    const current = this.favoriteIdsSignal();
    const next = current.includes(listingId)
      ? current.filter((id) => id !== listingId)
      : [...current, listingId];
    this.favoriteIdsSignal.set(next);
    this.writeFavorites(next);
  }

  private storageKey(): string {
    const userId = this.auth.currentUser()?.id ?? 'anonymous';
    return `${FAVORITES_KEY_PREFIX}${userId}`;
  }

  private readFavorites(): string[] {
    const raw = localStorage.getItem(this.storageKey());
    return raw ? (JSON.parse(raw) as string[]) : [];
  }

  private writeFavorites(ids: string[]): void {
    localStorage.setItem(this.storageKey(), JSON.stringify(ids));
  }
}
