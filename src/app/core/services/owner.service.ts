import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Owner, OwnerFilters, OwnerProfileInput } from '../models/owner.model';
import { Listing } from '../models/listing.model';
import { PagedResult } from '../models/paged-result.model';
import { OwnerDto, fromDto } from './owner-api.adapter';
import { ListingDto, fromDto as listingFromDto } from './listing-api.adapter';

// Mirrors AgentService's shape throughout, trimmed: no reviews, no specialties/company (those
// are agent-specific concepts a plain owner profile has no equivalent of).
@Injectable({ providedIn: 'root' })
export class OwnerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/owners`;

  private readonly ownersSignal = signal<Owner[]>([]);
  readonly owners = this.ownersSignal.asReadonly();

  private readonly totalCountSignal = signal(0);
  readonly totalCount = this.totalCountSignal.asReadonly();

  readonly loading = signal(false);
  readonly loadError = signal(false);
  private refreshSequence = 0;

  constructor() {
    this.refresh();
  }

  refresh(filters?: OwnerFilters, page = 1, pageSize = 20): void {
    const sequence = ++this.refreshSequence;
    const params: Record<string, string | number> = { page, pageSize };
    if (filters?.name) params['name'] = filters.name;

    this.loading.set(true);
    this.loadError.set(false);
    this.http
      .get<PagedResult<OwnerDto>>(this.apiUrl, { params })
      .pipe(finalize(() => { if (sequence === this.refreshSequence) this.loading.set(false); }))
      .subscribe({
        next: (res) => {
          if (sequence !== this.refreshSequence) return;
          this.ownersSignal.set(res.items.map(fromDto));
          this.totalCountSignal.set(res.totalCount);
        },
        error: () => {
          if (sequence === this.refreshSequence) this.loadError.set(true);
        }
      });
  }

  fetchById(id: number): Observable<Owner> {
    return this.http.get<OwnerDto>(`${this.apiUrl}/${id}`).pipe(map(fromDto));
  }

  // GET /api/owners/by-slug/JuanPerez — what OwnerDetailComponent calls for '/owners/:id',
  // mirroring AgentService.fetchBySlug.
  fetchBySlug(slug: string): Observable<Owner> {
    return this.http.get<OwnerDto>(`${this.apiUrl}/by-slug/${encodeURIComponent(slug)}`).pipe(map(fromDto));
  }

  recordView(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/view`, {});
  }

  fetchMine(): Observable<Owner> {
    return this.http.get<OwnerDto>(`${this.apiUrl}/me`).pipe(map(fromDto));
  }

  createMine(input: OwnerProfileInput): Observable<Owner> {
    return this.http.post<OwnerDto>(this.apiUrl, this.toFormData(input)).pipe(
      map(fromDto),
      tap((owner) => this.ownersSignal.update((list) => [...list, owner]))
    );
  }

  updateMine(input: OwnerProfileInput): Observable<Owner> {
    return this.http.put<OwnerDto>(`${this.apiUrl}/me`, this.toFormData(input)).pipe(
      map(fromDto),
      tap((owner) => this.ownersSignal.update((list) => list.map((o) => (o.id === owner.id ? owner : o))))
    );
  }

  private toFormData(input: OwnerProfileInput): FormData {
    const formData = new FormData();
    formData.append('phone', input.phone);
    if (input.photo) formData.append('photo', input.photo);
    if (input.bio) formData.append('bio', input.bio);
    return formData;
  }

  getListings(ownerId: number): Observable<Listing[]> {
    return this.http
      .get<ListingDto[]>(`${this.apiUrl}/${ownerId}/listings`)
      .pipe(map((listings) => listings.map(listingFromDto)));
  }

  contactOwner(ownerId: number, input: { name: string; phone: string; email: string; message: string }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${ownerId}/contact`, input);
  }

  // Admin-only (backend enforces the role check) — soft delete, one owner at a time.
  delete(ownerId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${ownerId}`);
  }
}
