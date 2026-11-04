import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  InfrastructureProjectDetail,
  InfrastructureProjectListItem,
  InfrastructureProjectPublic,
  InfrastructureProjectStatus,
  InfrastructureProjectType,
  InfrastructureProjectUpsertInput,
  PagedInfrastructureProjects
} from '../models/infrastructure-project.model';
import { environment } from '../../../environments/environment';

// Backend enums serialize as numbers when writing (Create/Update) but as their .ToString() name
// when reading — same convention as listing-api.adapter.ts's LISTING_TYPE_TO_NUMBER/FROM_STRING.
export const INFRASTRUCTURE_PROJECT_TYPE_TO_NUMBER: Record<InfrastructureProjectType, number> = {
  highwayExpansion: 0,
  newRoad: 1,
  industrialPark: 2,
  publicTransit: 3,
  hospital: 4,
  school: 5,
  other: 6
};
export const INFRASTRUCTURE_PROJECT_TYPE_FROM_STRING: Record<string, InfrastructureProjectType> = {
  HighwayExpansion: 'highwayExpansion',
  NewRoad: 'newRoad',
  IndustrialPark: 'industrialPark',
  PublicTransit: 'publicTransit',
  Hospital: 'hospital',
  School: 'school',
  Other: 'other'
};

export const INFRASTRUCTURE_PROJECT_STATUS_TO_NUMBER: Record<InfrastructureProjectStatus, number> = {
  announced: 0,
  inProgress: 1,
  completed: 2,
  cancelled: 3
};
export const INFRASTRUCTURE_PROJECT_STATUS_FROM_STRING: Record<string, InfrastructureProjectStatus> = {
  Announced: 'announced',
  InProgress: 'inProgress',
  Completed: 'completed',
  Cancelled: 'cancelled'
};

interface InfrastructureProjectPublicDto extends Omit<InfrastructureProjectPublic, 'type' | 'status'> {
  type: string;
  status: string;
}
interface InfrastructureProjectListItemDto extends Omit<InfrastructureProjectListItem, 'type' | 'status'> {
  type: string;
  status: string;
}
interface InfrastructureProjectDetailDto extends Omit<InfrastructureProjectDetail, 'type' | 'status'> {
  type: string;
  status: string;
}

const fromPublicDto = (dto: InfrastructureProjectPublicDto): InfrastructureProjectPublic => ({
  ...dto,
  type: INFRASTRUCTURE_PROJECT_TYPE_FROM_STRING[dto.type],
  status: INFRASTRUCTURE_PROJECT_STATUS_FROM_STRING[dto.status]
});
const fromListItemDto = (dto: InfrastructureProjectListItemDto): InfrastructureProjectListItem => ({
  ...dto,
  type: INFRASTRUCTURE_PROJECT_TYPE_FROM_STRING[dto.type],
  status: INFRASTRUCTURE_PROJECT_STATUS_FROM_STRING[dto.status]
});
const fromDetailDto = (dto: InfrastructureProjectDetailDto): InfrastructureProjectDetail => ({
  ...dto,
  type: INFRASTRUCTURE_PROJECT_TYPE_FROM_STRING[dto.type],
  status: INFRASTRUCTURE_PROJECT_STATUS_FROM_STRING[dto.status]
});
const toUpsertBody = (input: InfrastructureProjectUpsertInput) => ({
  ...input,
  type: INFRASTRUCTURE_PROJECT_TYPE_TO_NUMBER[input.type],
  status: INFRASTRUCTURE_PROJECT_STATUS_TO_NUMBER[input.status]
});

@Injectable({ providedIn: 'root' })
export class InfrastructureProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/infrastructure-projects`;

  listPublished(): Observable<InfrastructureProjectPublic[]> {
    return this.http
      .get<InfrastructureProjectPublicDto[]>(`${this.apiUrl}/published`)
      .pipe(map((items) => items.map(fromPublicDto)));
  }

  list(options: { page?: number; pageSize?: number } = {}): Observable<PagedInfrastructureProjects> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.pageSize) params = params.set('pageSize', String(options.pageSize));

    return this.http
      .get<{ items: InfrastructureProjectListItemDto[]; page: number; pageSize: number; totalCount: number }>(this.apiUrl, { params })
      .pipe(map((result) => ({ ...result, items: result.items.map(fromListItemDto) })));
  }

  getDetail(id: string): Observable<InfrastructureProjectDetail> {
    return this.http.get<InfrastructureProjectDetailDto>(`${this.apiUrl}/${id}`).pipe(map(fromDetailDto));
  }

  create(input: InfrastructureProjectUpsertInput): Observable<InfrastructureProjectDetail> {
    return this.http.post<InfrastructureProjectDetailDto>(this.apiUrl, toUpsertBody(input)).pipe(map(fromDetailDto));
  }

  update(id: string, input: InfrastructureProjectUpsertInput): Observable<InfrastructureProjectDetail> {
    return this.http.put<InfrastructureProjectDetailDto>(`${this.apiUrl}/${id}`, toUpsertBody(input)).pipe(map(fromDetailDto));
  }

  cancel(id: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/cancel`, {});
  }
}
