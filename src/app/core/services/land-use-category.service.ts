import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LandUseCategory {
  id: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class LandUseCategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/land-use-categories`;

  // Fixed, admin-seeded catalog (Urbano, Urbanizable, No urbanizable, Industrial, Residencial,
  // Comercial, Agrícola) — callers fetch once and cache, not on every render.
  listAll(): Observable<LandUseCategory[]> {
    return this.http.get<LandUseCategory[]>(this.apiUrl);
  }
}
