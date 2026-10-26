import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CmaResult, Listing, ListingDraft, ListingInput, ListingOwnerContactInput, ListingQuota, PriceHistoryEntry, PropertyType, ViabilityAnalysis } from '../models/listing.model';
import { PagedResult } from '../models/paged-result.model';
import {
  CmaResultDto,
  ListingDraftDto,
  ListingDto,
  ListingPriceHistoryDto,
  ListingQuotaDto,
  PROPERTY_TYPE_TO_NUMBER,
  ViabilityAnalysisDto,
  cmaResultFromDto,
  fromDto,
  listingDraftFromDto,
  priceHistoryFromDto,
  toFormData,
  viabilityAnalysisFromDto
} from './listing-api.adapter';

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

  // The single most-recently-created listing (no filters) — the backend's own default Search
  // ordering is already newest-first, so pageSize=1 with no other params gives it directly,
  // without pulling the first page of the general feed just to read its [0]. Used by the map's
  // initial center (see map-view.component.ts) so a first-time visitor opens looking at the
  // latest property instead of an arbitrary fixed point. Resolves to null when there are no
  // listings at all yet.
  fetchLatest(): Observable<Listing | null> {
    return this.http
      .get<PagedResult<ListingDto>>(this.apiUrl, { params: { pageSize: 1 } })
      .pipe(map((res) => (res.items.length > 0 ? fromDto(res.items[0]) : null)));
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

  // Comparative-market-analysis for an agent-drawn area (map-view.component.ts's freehand-draw
  // shape) — price-per-sqft/days-on-market stats for active, priced listings inside it, split
  // sale vs. rent, plus a capped comparables list. points must have at least 3 entries (the
  // backend rejects fewer); not deduplicated against the main `listings` signal above, since
  // this needs every matching listing in the area, not just the ~100 most recent site-wide.
  getCma(points: { lat: number; lng: number }[], propertyType?: PropertyType): Observable<CmaResult> {
    return this.http
      .post<CmaResultDto>(`${this.apiUrl}/cma`, {
        points,
        propertyType: propertyType != null ? PROPERTY_TYPE_TO_NUMBER[propertyType] : null
      })
      .pipe(map(cmaResultFromDto));
  }

  // The free, ungated half of the "Reporte de Viabilidad Comercial" lead magnet — every business
  // type's fit score + why, shown directly on the page. Only listings.component checks whether
  // the listing's own property type is eligible before calling this (404s otherwise).
  getViabilityPreview(id: string): Observable<ViabilityAnalysis> {
    return this.http.get<ViabilityAnalysisDto>(`${this.apiUrl}/${id}/viability-preview`).pipe(map(viabilityAnalysisFromDto));
  }

  // Best-effort autofill for /listings/new: sends a pasted classified-ad text, gets back the
  // structured fields the backend's AI parsing could confidently extract. Never creates or
  // touches a listing — the caller patches its own form with the result.
  parseDraft(text: string): Observable<ListingDraft> {
    return this.http.post<ListingDraftDto>(`${this.apiUrl}/parse-draft`, { text }).pipe(map(listingDraftFromDto));
  }

  // The gated half: captures the lead's name/email (no login required — a lead magnet has to
  // work for an anonymous visitor), triggers the full PDF report by email server-side, AND
  // returns that same PDF in the response so the page can offer an immediate download too —
  // the lead is already captured either way, no reason to make them wait on email for it.
  requestViabilityReport(id: string, input: { name: string; email: string; phone?: string }): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/${id}/viability-report`, input, { responseType: 'blob' });
  }

  // Admin-only — ListingsController.UpdateOwnerContact, a separate endpoint from the regular
  // update() below since it doesn't require the caller to be the listing's own owner (see its
  // own comment). Used by listing-form.component.ts's admin-only owner-contact section.
  updateOwnerContact(id: string, input: ListingOwnerContactInput): Observable<Listing> {
    return this.http.put<ListingDto>(`${this.apiUrl}/${id}/owner-contact`, input).pipe(map(fromDto));
  }

  // Emails the real property owner directly (set via updateOwnerContact above) instead of
  // creating an Inquiry — see ListingsController.ContactOwner for why. Only meaningful once
  // hideAgentContact is set; the backend 404s otherwise.
  contactOwner(id: string, input: { name: string; phone: string; email: string; message: string }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/contact-owner`, input);
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

  // Admin-only (backend enforces the role check) — reassigns the listing to a different agent.
  transfer(id: string, agentId: number): Observable<Listing> {
    return this.http.patch<ListingDto>(`${this.apiUrl}/${id}/transfer`, { agentId }).pipe(
      map(fromDto),
      tap((listing) => this.listingsSignal.update((list) => list.map((l) => (l.id === id ? listing : l))))
    );
  }

  // Map's "editar ubicación" pin-drag flow (map-view.component.ts) — owner-only, backend-enforced.
  updateLocation(id: string, lat: number, lng: number): Observable<Listing> {
    return this.http.patch<ListingDto>(`${this.apiUrl}/${id}/location`, { latitude: lat, longitude: lng }).pipe(
      map(fromDto),
      tap((listing) => this.listingsSignal.update((list) => list.map((l) => (l.id === id ? listing : l))))
    );
  }
}
