import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Agency, AgencyFilters, AgencyProfileInput } from '../models/agency.model';
import { PagedResult } from '../models/paged-result.model';
import { BrokerageDto, fromDto } from './brokerage-api.adapter';

@Injectable({ providedIn: 'root' })
export class BrokerageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/brokerages`;

  private readonly agenciesSignal = signal<Agency[]>([]);
  readonly agencies = this.agenciesSignal.asReadonly();

  private readonly totalCountSignal = signal(0);
  readonly totalCount = this.totalCountSignal.asReadonly();

  // GET /api/brokerages?search= — bare names only, used by the agent-signup autocomplete.
  search(term?: string): Observable<string[]> {
    const params: Record<string, string> = {};
    if (term) params['search'] = term;

    return this.http.get<string[]>(this.apiUrl, { params });
  }

  // GET /api/brokerages/directory — the public /inmobiliarias listing page: full profiles +
  // agent/listing counts, paginated.
  refreshDirectory(filters?: AgencyFilters, page = 1, pageSize = 20): void {
    const params: Record<string, string | number> = { page, pageSize };
    if (filters?.name) params['name'] = filters.name;
    if (filters?.state) params['state'] = filters.state;
    if (filters?.city) params['city'] = filters.city;

    this.http.get<PagedResult<BrokerageDto>>(`${this.apiUrl}/directory`, { params }).subscribe((res) => {
      this.agenciesSignal.set(res.items.map(fromDto));
      this.totalCountSignal.set(res.totalCount);
    });
  }

  fetchById(id: number): Observable<Agency> {
    return this.http.get<BrokerageDto>(`${this.apiUrl}/${id}`).pipe(map(fromDto));
  }

  // GET /api/brokerages/mine — the caller's own agency; the caller handles the 404 case
  // (independent agent, or no agent profile yet).
  fetchMine(): Observable<Agency> {
    return this.http.get<BrokerageDto>(`${this.apiUrl}/mine`).pipe(map(fromDto));
  }

  updateMine(id: number, input: AgencyProfileInput): Observable<Agency> {
    return this.http.put<BrokerageDto>(`${this.apiUrl}/${id}`, this.toFormData(input)).pipe(map(fromDto));
  }

  private toFormData(input: AgencyProfileInput): FormData {
    const formData = new FormData();
    if (input.state) formData.append('state', input.state);
    if (input.city) formData.append('city', input.city);
    if (input.website) formData.append('website', input.website);
    if (input.description) formData.append('description', input.description);
    if (input.facebookUrl) formData.append('facebookUrl', input.facebookUrl);
    if (input.instagramUrl) formData.append('instagramUrl', input.instagramUrl);
    if (input.logo) formData.append('logo', input.logo);
    return formData;
  }
}
