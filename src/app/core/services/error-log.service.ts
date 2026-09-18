import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ErrorLogDetail, PagedErrorLogs } from '../models/error-log.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ErrorLogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/errors`;

  list(options: { resolved?: boolean; page?: number; pageSize?: number } = {}): Observable<PagedErrorLogs> {
    let params = new HttpParams();
    if (options.resolved !== undefined) params = params.set('resolved', String(options.resolved));
    if (options.page) params = params.set('page', String(options.page));
    if (options.pageSize) params = params.set('pageSize', String(options.pageSize));

    return this.http.get<PagedErrorLogs>(this.apiUrl, { params });
  }

  resolve(id: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/resolve`, {});
  }

  getDetail(id: string): Observable<ErrorLogDetail> {
    return this.http.get<ErrorLogDetail>(`${this.apiUrl}/${id}`);
  }
}
