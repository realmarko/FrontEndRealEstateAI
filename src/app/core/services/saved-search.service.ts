import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SavedSearch, SavedSearchInput } from '../models/saved-search.model';
import { SavedSearchDto, fromDto, toCreateBody } from './saved-search-api.adapter';

@Injectable({ providedIn: 'root' })
export class SavedSearchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/saved-searches`;

  private readonly savedSearchesSignal = signal<SavedSearch[]>([]);
  readonly savedSearches = this.savedSearchesSignal.asReadonly();

  refresh(): void {
    this.http.get<SavedSearchDto[]>(this.apiUrl).subscribe((dtos) => this.savedSearchesSignal.set(dtos.map(fromDto)));
  }

  create(input: SavedSearchInput) {
    return this.http.post<SavedSearchDto>(this.apiUrl, toCreateBody(input)).pipe(
      tap((dto) => this.savedSearchesSignal.update((list) => [fromDto(dto), ...list]))
    );
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.savedSearchesSignal.update((list) => list.filter((s) => s.id !== id)))
    );
  }
}
