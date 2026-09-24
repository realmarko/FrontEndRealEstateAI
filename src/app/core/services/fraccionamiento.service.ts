import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ApproveFraccionamientoInput,
  CreateFraccionamientoInput,
  CreateFraccionamientoResult,
  FraccionamientoDetail,
  FraccionamientoPublicDetail,
  FraccionamientoStatus,
  PagedFraccionamientos,
  PagedFraccionamientosPublic
} from '../models/fraccionamiento.model';
import { ListingDto, fromDto } from './listing-api.adapter';
import { environment } from '../../../environments/environment';

interface FraccionamientoPublicDetailDto extends Omit<FraccionamientoPublicDetail, 'listings'> {
  listings: ListingDto[];
}

@Injectable({ providedIn: 'root' })
export class FraccionamientoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/fraccionamientos`;

  create(input: CreateFraccionamientoInput): Observable<CreateFraccionamientoResult> {
    return this.http.post<CreateFraccionamientoResult>(this.apiUrl, input);
  }

  list(options: { status?: FraccionamientoStatus; page?: number; pageSize?: number } = {}): Observable<PagedFraccionamientos> {
    let params = new HttpParams();
    if (options.status) params = params.set('status', options.status);
    if (options.page) params = params.set('page', String(options.page));
    if (options.pageSize) params = params.set('pageSize', String(options.pageSize));

    return this.http.get<PagedFraccionamientos>(this.apiUrl, { params });
  }

  getDetail(id: string): Observable<FraccionamientoDetail> {
    return this.http.get<FraccionamientoDetail>(`${this.apiUrl}/${id}`);
  }

  approve(id: string, input: ApproveFraccionamientoInput): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/approve`, input);
  }

  reject(id: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/reject`, {});
  }

  merge(id: string, targetFraccionamientoId: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/merge`, { targetFraccionamientoId });
  }

  listPublished(options: { page?: number; pageSize?: number } = {}): Observable<PagedFraccionamientosPublic> {
    let params = new HttpParams();
    if (options.page) params = params.set('page', String(options.page));
    if (options.pageSize) params = params.set('pageSize', String(options.pageSize));

    return this.http.get<PagedFraccionamientosPublic>(`${this.apiUrl}/published`, { params });
  }

  getPublishedDetail(id: string): Observable<FraccionamientoPublicDetail> {
    return this.http
      .get<FraccionamientoPublicDetailDto>(`${this.apiUrl}/published/${id}`)
      .pipe(map((dto) => ({ ...dto, listings: dto.listings.map(fromDto) })));
  }

  contact(id: string, input: { name: string; phone: string; email: string; message: string }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/published/${id}/contact`, input);
  }
}
