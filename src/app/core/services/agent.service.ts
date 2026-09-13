import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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

  constructor() {
    this.refresh();
  }

  refresh(filters?: AgentFilters, page = 1, pageSize = 20): void {
    const params: Record<string, string | number> = { page, pageSize };
    if (filters?.name) params['name'] = filters.name;
    if (filters?.specialty) params['specialty'] = filters.specialty;
    if (filters?.company) params['company'] = filters.company;
    if (filters?.minRating) params['minRating'] = filters.minRating;

    this.http.get<PagedResult<AgentDto>>(this.apiUrl, { params }).subscribe((res) => {
      this.agentsSignal.set(res.items.map(fromDto));
      this.totalCountSignal.set(res.totalCount);
    });
  }

  fetchById(id: number): Observable<Agent> {
    return this.http.get<AgentDto>(`${this.apiUrl}/${id}`).pipe(map(fromDto));
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
}
