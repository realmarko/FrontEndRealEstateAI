import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BrokerageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/brokerages`;

  search(term?: string): Observable<string[]> {
    const params: Record<string, string> = {};
    if (term) params['search'] = term;

    return this.http.get<string[]>(this.apiUrl, { params });
  }
}
