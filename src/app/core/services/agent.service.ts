import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Agent, AgentFilters, AgentProfileInput, AgentReview } from '../models/agent.model';
import { Listing } from '../models/listing.model';
import { PagedResult } from '../models/paged-result.model';
import { AgentDto, AgentReviewDto, fromDto, reviewFromDto } from './agent-api.adapter';
import { ListingDto, fromDto as listingFromDto } from './listing-api.adapter';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/agents`;

  private readonly agentsSignal = signal<Agent[]>([]);
  readonly agents = this.agentsSignal.asReadonly();

  private readonly totalCountSignal = signal(0);
  readonly totalCount = this.totalCountSignal.asReadonly();

  // Exposed so /agents can render its own loading/error states — refresh() previously had no
  // error handling at all, so a failed fetch looked identical to a genuinely empty result.
  readonly loading = signal(false);
  readonly loadError = signal(false);
  // Bumped on every refresh() call and captured per-request — AgentsListComponent's debounced
  // search/pagination can fire a new refresh() before an earlier call's response arrives; without
  // this, that stale response's next/error handler could overwrite state set by a newer,
  // already-resolved call (e.g. an older, broader search result landing after a narrower one).
  private refreshSequence = 0;

  constructor() {
    this.refresh();
  }

  refresh(filters?: AgentFilters, page = 1, pageSize = 20): void {
    const sequence = ++this.refreshSequence;
    const params: Record<string, string | number> = { page, pageSize };
    if (filters?.name) params['name'] = filters.name;
    if (filters?.specialty) params['specialty'] = filters.specialty;
    if (filters?.company) params['company'] = filters.company;
    if (filters?.minRating) params['minRating'] = filters.minRating;

    this.loading.set(true);
    this.loadError.set(false);
    this.http
      .get<PagedResult<AgentDto>>(this.apiUrl, { params })
      .pipe(finalize(() => { if (sequence === this.refreshSequence) this.loading.set(false); }))
      .subscribe({
        next: (res) => {
          if (sequence !== this.refreshSequence) return;
          this.agentsSignal.set(res.items.map(fromDto));
          this.totalCountSignal.set(res.totalCount);
        },
        error: () => {
          if (sequence === this.refreshSequence) this.loadError.set(true);
        }
      });
  }

  fetchById(id: number): Observable<Agent> {
    return this.http.get<AgentDto>(`${this.apiUrl}/${id}`).pipe(map(fromDto));
  }

  // Fire-and-forget from the detail page (see agent-detail.component.ts, which debounces repeat
  // calls per browser) — no response body to act on.
  recordView(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/view`, {});
  }

  fetchMine(): Observable<Agent> {
    return this.http.get<AgentDto>(`${this.apiUrl}/me`).pipe(map(fromDto));
  }

  createMine(input: AgentProfileInput): Observable<Agent> {
    return this.http.post<AgentDto>(this.apiUrl, this.toFormData(input)).pipe(
      map(fromDto),
      tap((agent) => this.agentsSignal.update((list) => [...list, agent]))
    );
  }

  updateMine(input: AgentProfileInput): Observable<Agent> {
    return this.http.put<AgentDto>(`${this.apiUrl}/me`, this.toFormData(input)).pipe(
      map(fromDto),
      tap((agent) => this.agentsSignal.update((list) => list.map((a) => (a.id === agent.id ? agent : a))))
    );
  }

  private toFormData(input: AgentProfileInput): FormData {
    const formData = new FormData();
    formData.append('phone', input.phone);
    if (input.company) formData.append('company', input.company);
    formData.append('isIndependent', String(input.isIndependent ?? false));
    if (input.photo) formData.append('photo', input.photo);
    if (input.bio) formData.append('bio', input.bio);
    if (input.specialties?.length) formData.append('specialties', input.specialties.join(','));
    return formData;
  }

  getListings(agentId: number): Observable<Listing[]> {
    return this.http
      .get<ListingDto[]>(`${this.apiUrl}/${agentId}/listings`)
      .pipe(map((listings) => listings.map(listingFromDto)));
  }

  getReviews(agentId: number): Observable<AgentReview[]> {
    return this.http
      .get<AgentReviewDto[]>(`${this.apiUrl}/${agentId}/reviews`)
      .pipe(map((reviews) => reviews.map(reviewFromDto)));
  }

  addReview(agentId: number, rating: number, comment?: string): Observable<AgentReview> {
    return this.http
      .post<AgentReviewDto>(`${this.apiUrl}/${agentId}/reviews`, { rating, comment })
      .pipe(map(reviewFromDto));
  }

  deleteReview(agentId: number, reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${agentId}/reviews/${reviewId}`);
  }

  contactAgent(agentId: number, input: { name: string; phone: string; email: string; message: string }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${agentId}/contact`, input);
  }

  // Admin-only (backend enforces the role check) — soft delete, one agent at a time.
  delete(agentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${agentId}`);
  }
}
