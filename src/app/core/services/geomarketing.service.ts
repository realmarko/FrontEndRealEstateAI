import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BusinessDensity {
  count: number;
}

// Mirrors the backend's SocioeconomicLevel enum by name — named and exported (rather than left
// inline) so a Record built over it, like SOCIOECONOMIC_LEVEL_LABEL_KEYS in map-view.component.ts,
// gets compile-time exhaustiveness checking if a level is ever added or renamed, the same way
// FundingMethod/PurchaseTimeline already do for FUNDING_METHOD_KEYS/TIMELINE_KEYS.
export type SocioeconomicLevel = 'Bajo' | 'MedioBajo' | 'Medio' | 'MedioAlto' | 'Alto';

export interface PopulationDensity {
  population: number;
  areaSqKm: number;
  densityPerSqKm: number;
  censusYear: number;
  // Proxy estimated from public INEGI Census indicators, not the commercial AMAI NSE
  // classification — see SocioeconomicLevel on the backend. Null when the AGEB has too little
  // source data to estimate.
  socioeconomicScore: number | null;
  estimatedSocioeconomicLevel: SocioeconomicLevel | null;
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
