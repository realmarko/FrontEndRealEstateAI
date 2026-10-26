import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { WeeklyPageViews } from '../models/page-view.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PageViewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/page-views`;

  // Fire-and-forget from the app root on every NavigationEnd (see app.ts) — sitewide, every
  // visitor, no response body to act on. Same shape as ListingService.recordView/
  // AgentService.recordView, but deliberately NOT deduplicated per browser the way those are:
  // this is raw site traffic, not a per-entity "unique view" counter.
  record(pathPattern: string, path: string): Observable<void> {
    return this.http.post<void>(this.apiUrl, { pathPattern, path });
  }

  // Admin-only — see PageViewsController.Stats, which 403s anyone else.
  getStats(weeks = 8): Observable<WeeklyPageViews[]> {
    const params = new HttpParams().set('weeks', String(weeks));
    return this.http.get<WeeklyPageViews[]>(`${this.apiUrl}/stats`, { params });
  }
}
