import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BusinessDensity {
  count: number;
}

export interface PopulationDensity {
  population: number;
  areaSqKm: number;
  densityPerSqKm: number;
  censusYear: number;
}

@Injectable({ providedIn: 'root' })
export class GeomarketingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/geomarketing`;

  // Counts INEGI DENUE-registered businesses matching searchTerm within radiusMeters of
  // (lat, lng) — see GeomarketingController.BusinessDensity. Proxied through our own backend
  // (not called directly from here) so INEGI's token never reaches the browser.
  businessDensity(searchTerm: string, lat: number, lng: number, radiusMeters: number): Observable<BusinessDensity> {
    return this.http.get<BusinessDensity>(`${this.apiUrl}/business-density`, {
      params: { searchTerm, lat: String(lat), lng: String(lng), radiusMeters: String(radiusMeters) }
    });
  }

  // Real 2020-census population of the INEGI AGEB containing (lat, lng) — see
  // GeomarketingController.PopulationDensity. 404s where no AGEB has been imported yet (today,
  // outside Puebla state); callers should treat that as "unavailable", not an error.
  populationDensity(lat: number, lng: number): Observable<PopulationDensity> {
    return this.http.get<PopulationDensity>(`${this.apiUrl}/population-density`, {
      params: { lat: String(lat), lng: String(lng) }
    });
  }
}
