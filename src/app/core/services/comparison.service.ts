import { Injectable, computed, effect, signal } from '@angular/core';

const STORAGE_KEY = 'reapp_compare_ids';
// Keeps the comparison table legible (a 5th+ column would force horizontal scrolling on top of
// an already-wide table) and matches the row of thumbnails the floating compare bar shows.
export const MAX_COMPARE_LISTINGS = 4;

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// Client-only, anonymous-friendly selection (unlike FavoritesService, which is backend-backed
// and requires an account) — comparing a few listings while browsing shouldn't require signing
// in, and there's nothing here worth syncing across devices. Persisted to localStorage only so a
// reload or a follow-up visit to /comparar doesn't lose the selection mid-session.
@Injectable({ providedIn: 'root' })
export class ComparisonService {
  private readonly idsSignal = signal<string[]>(loadFromStorage());

  readonly ids = this.idsSignal.asReadonly();
  readonly count = computed(() => this.idsSignal().length);
  readonly isFull = computed(() => this.idsSignal().length >= MAX_COMPARE_LISTINGS);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.idsSignal()));
      } catch {
        // Storage can throw in a private-browsing mode with a full/blocked quota — the
        // in-memory signal still works for the rest of this session, just won't survive reload.
      }
    });
  }

  isSelected(listingId: string): boolean {
    return this.idsSignal().includes(listingId);
  }

  toggle(listingId: string): void {
    if (this.isSelected(listingId)) {
      this.remove(listingId);
    } else if (!this.isFull()) {
      this.idsSignal.update((ids) => [...ids, listingId]);
    }
  }

  remove(listingId: string): void {
    this.idsSignal.update((ids) => ids.filter((id) => id !== listingId));
  }

  clear(): void {
    this.idsSignal.set([]);
  }
}
