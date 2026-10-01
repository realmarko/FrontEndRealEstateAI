import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
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

export interface MunicipalityListItem {
  cvegeo: string;
  name: string;
  stateName: string;
}

export interface StateListItem {
  code: string;
  name: string;
}

// Raw GeoJSON Geometry as the backend's GeoJsonWriter produces it — coordinates are [lng, lat]
// pairs per the GeoJSON spec (opposite order from google.maps.LatLngLiteral), one ring deeper for
// MultiPolygon than Polygon. See toLatLngPaths in map-view.component.ts for the conversion.
export interface GeoJsonPolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}
export interface GeoJsonMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}
export type GeoJsonGeometry = GeoJsonPolygonGeometry | GeoJsonMultiPolygonGeometry;

export interface MunicipalityBoundary {
  cvegeo: string;
  name: string;
  boundary: GeoJsonGeometry;
}

export interface AgebBoundary {
  cvegeo: string;
  boundary: GeoJsonGeometry;
  estimatedSocioeconomicLevel: SocioeconomicLevel | null;
}

@Injectable({ providedIn: 'root' })
export class GeomarketingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/geomarketing`;

  // Fetched once here (root-scoped service, so this constructor runs once per app load) and
  // cached in a signal — same pattern as LandUseCategoryService.categories. Previously each
  // caller (listing-form, map-view) fetched its own copy in its own constructor, so every
  // navigation to /listings/new or /map re-fetched both lists from the backend despite the
  // comments on listStates/listMunicipalities below claiming callers already cached them — they
  // didn't actually do so until now.
  private readonly statesSignal = signal<StateListItem[]>([]);
  readonly states = this.statesSignal.asReadonly();

  private readonly municipalitiesSignal = signal<MunicipalityListItem[]>([]);
  readonly municipalities = this.municipalitiesSignal.asReadonly();

  constructor() {
    this.listStates().subscribe((list) => this.statesSignal.set(list));
    this.listMunicipalities().subscribe((list) => this.municipalitiesSignal.set(list));
  }

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

  // Small, near-static list (217 rows for Puebla today). Prefer the `municipalities` signal
  // above, which already holds this — this raw HTTP call exists for that signal's own initial
  // fetch and isn't meant to be called a second time per component.
  listMunicipalities(): Observable<MunicipalityListItem[]> {
    return this.http.get<MunicipalityListItem[]>(`${this.apiUrl}/municipalities`);
  }

  // All 32 Mexican states — static reference data. Prefer the `states` signal above, which
  // already holds this — this raw HTTP call exists for that signal's own initial fetch and isn't
  // meant to be called a second time per component.
  listStates(): Observable<StateListItem[]> {
    return this.http.get<StateListItem[]>(`${this.apiUrl}/states`);
  }

  getMunicipalityBoundary(cvegeo: string): Observable<MunicipalityBoundary> {
    return this.http.get<MunicipalityBoundary>(`${this.apiUrl}/municipalities/${cvegeo}/boundary`);
  }

  // AGEBs intersecting the given viewport — see GeomarketingController.ListAgebsInBounds.
  agebsInBounds(swLat: number, swLng: number, neLat: number, neLng: number): Observable<AgebBoundary[]> {
    return this.http.get<AgebBoundary[]>(`${this.apiUrl}/agebs`, {
      params: { swLat: String(swLat), swLng: String(swLng), neLat: String(neLat), neLng: String(neLng) }
    });
  }
}
