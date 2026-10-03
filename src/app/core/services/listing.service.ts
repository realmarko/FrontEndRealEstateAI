import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Listing, ListingInput, ListingQuota, PriceHistoryEntry } from '../models/listing.model';
import { PagedResult } from '../models/paged-result.model';
import { ListingDto, ListingPriceHistoryDto, ListingQuotaDto, fromDto, priceHistoryFromDto, toFormData } from './listing-api.adapter';

@Injectable({ providedIn: 'root' })
export class ListingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/listings`;

  private readonly listingsSignal = signal<Listing[]>([]);
  readonly listings = this.listingsSignal.asReadonly();

  // Exposed so /listings can render its own loading/error states — refresh() previously had no
  // error handling at all, so a failed fetch looked identical to a genuinely empty result.
  readonly loading = signal(false);
  readonly loadError = signal(false);
  // Bumped on every refresh() call and captured per-request — more than one refresh() can be in
  // flight at once (the constructor's own call racing a caller-triggered one right after), and
  // without this a stale response's handler could overwrite state set by a newer, already-
  // resolved call.
  private refreshSequence = 0;

  constructor() {
    this.refresh();
  }

  refresh(): void {
    const sequence = ++this.refreshSequence;
    this.loading.set(true);
    this.loadError.set(false);
    this.http
      .get<PagedResult<ListingDto>>(this.apiUrl, { params: { pageSize: 100 } })
      .pipe(finalize(() => { if (sequence === this.refreshSequence) this.loading.set(false); }))
      .subscribe({
        next: (res) => {
          if (sequence !== this.refreshSequence) return;
          this.listingsSignal.set(res.items.map(fromDto));
        },
        error: () => {
          if (sequence === this.refreshSequence) this.loadError.set(true);
        }
      });
  }

  getById(id: string): Listing | undefined {
    return this.listingsSignal().find((listing) => listing.id === id);
  }

  fetchById(id: string): Observable<Listing> {
    return this.http.get<ListingDto>(`${this.apiUrl}/${id}`).pipe(map(fromDto));
  }

  // Fire-and-forget from the detail page (see listing-detail.component.ts, which debounces
  // repeat calls per browser) — no response body to act on.
  recordView(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/view`, {});
  }

  getPriceHistory(id: string): Observable<PriceHistoryEntry[]> {
    return this.http
      .get<ListingPriceHistoryDto[]>(`${this.apiUrl}/${id}/price-history`)
      .pipe(map((entries) => entries.map(priceHistoryFromDto)));
  }

  getSimilar(id: string): Observable<Listing[]> {
    return this.http.get<ListingDto[]>(`${this.apiUrl}/${id}/similar`).pipe(map((dtos) => dtos.map(fromDto)));
  }

  // Listings owned by any agent belonging to this agency — for the /inmobiliarias/:id page.
  // Deliberately bypasses the shared `listings` signal (that one holds the site-wide feed) and
  // queries the backend's own BrokerageId filter directly instead of filtering it client-side.
  fetchByAgency(agencyId: number): Observable<Listing[]> {
    return this.http
      .get<PagedResult<ListingDto>>(this.apiUrl, { params: { brokerageId: agencyId, pageSize: 100 } })
      .pipe(map((res) => res.items.map(fromDto)));
  }

  // Owner/Agent's remaining listing quota for the current calendar month — used by the
  // quota panel on the "new listing" form, not by the general listings feed.
  getMyQuota(): Observable<ListingQuota> {
    return this.http.get<ListingQuotaDto>(`${this.apiUrl}/mine/quota`);
  }

  create(input: ListingInput): Observable<Listing> {
    return this.http.post<ListingDto>(this.apiUrl, toFormData(input)).pipe(
      map(fromDto),
      tap((listing) => this.listingsSignal.update((list) => [listing, ...list]))
    );
  }

  update(id: string, input: ListingInput): Observable<Listing> {
    return this.http.put<ListingDto>(`${this.apiUrl}/${id}`, toFormData(input, 0)).pipe(
      map(fromDto),
      tap((listing) =>
        this.listingsSignal.update((list) => list.map((l) => (l.id === id ? listing : l)))
      )
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.listingsSignal.update((list) => list.filter((l) => l.id !== id)))
    );
  }
}
