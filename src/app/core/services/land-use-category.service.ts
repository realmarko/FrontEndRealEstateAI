import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
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

  // Fetched once here (root-scoped service, so this constructor runs once per app load) and
  // cached in a signal — lets a list of many cards (ListingCardComponent) resolve a
  // landUseCategoryId to a name synchronously, without each card firing its own HTTP request.
  private readonly categoriesSignal = signal<LandUseCategory[]>([]);
  readonly categories = this.categoriesSignal.asReadonly();

  constructor() {
    this.listAll().subscribe((list) => this.categoriesSignal.set(list));
  }

  // Fixed, admin-seeded catalog (Urbano, Urbanizable, No urbanizable, Industrial, Residencial,
  // Comercial, Agrícola). Callers that just need to display an already-known id's name should
  // prefer the `categories` signal above over calling this again.
  listAll(): Observable<LandUseCategory[]> {
    return this.http.get<LandUseCategory[]>(this.apiUrl);
  }
}
