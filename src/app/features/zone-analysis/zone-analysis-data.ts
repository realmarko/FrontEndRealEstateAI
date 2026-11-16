// Curated set of Puebla-metro municipalities for the zone-analysis SEO pages — deliberately a
// fixed, hand-picked list (not all 217 Puebla-state municipalities from
// GeomarketingService.municipalities) to keep DENUE lookups at build/request time small; see
// app.routes.server.ts's own reasoning for why viability/residential-analysis routes stay
// client-only. cvegeo matches GeomarketingService.MunicipalityListItem for the same municipality,
// useful if a future page wants to cross-reference it (e.g. getMunicipalityBoundary).
// lat/lng are each municipality's own urban center (not a population-weighted centroid), chosen so
// the AGEB-level population/business density lookups land in the actually built-up area.
export interface ZoneAnalysisZone {
  slug: string;
  cvegeo: string;
  name: string;
  lat: number;
  lng: number;
}

export const ZONE_ANALYSIS_ZONES: readonly ZoneAnalysisZone[] = [
  { slug: 'puebla', cvegeo: '21114', name: 'Puebla', lat: 19.0414, lng: -98.2063 },
  { slug: 'san-andres-cholula', cvegeo: '21119', name: 'San Andrés Cholula', lat: 19.0558, lng: -98.2831 },
  { slug: 'san-pedro-cholula', cvegeo: '21140', name: 'San Pedro Cholula', lat: 19.0636, lng: -98.3077 },
  { slug: 'cuautlancingo', cvegeo: '21041', name: 'Cuautlancingo', lat: 19.0867, lng: -98.2436 },
  { slug: 'amozoc', cvegeo: '21015', name: 'Amozoc', lat: 19.0317, lng: -98.0486 },
  { slug: 'san-martin-texmelucan', cvegeo: '21132', name: 'San Martín Texmelucan', lat: 19.2822, lng: -98.4322 },
  { slug: 'atlixco', cvegeo: '21019', name: 'Atlixco', lat: 18.9083, lng: -98.4342 },
  { slug: 'huejotzingo', cvegeo: '21074', name: 'Huejotzingo', lat: 19.1517, lng: -98.4 }
];

export function findZoneBySlug(slug: string): ZoneAnalysisZone | undefined {
  return ZONE_ANALYSIS_ZONES.find((zone) => zone.slug === slug);
}

// Businesses whose DENUE search term the backend already whitelists (AllowedSearchTerms — see
// map-view.component.ts's OPPORTUNITY_CATEGORIES) and that double as the land-flipping niche's
// own buyer list (selling vacant lots to OXXO/farmacias/gasolineras) — same term+radius pairing
// used there, kept in sync rather than invented fresh for this page.
export interface NicheBusinessCategory {
  denueSearchTerm: 'oxxo' | 'farmacia' | 'gasolinera';
  radiusMeters: number;
  labelKey: string;
}

export const NICHE_BUSINESS_CATEGORIES: readonly NicheBusinessCategory[] = [
  { denueSearchTerm: 'oxxo', radiusMeters: 500, labelKey: 'zoneAnalysisDetail.categoryOxxo' },
  { denueSearchTerm: 'farmacia', radiusMeters: 1000, labelKey: 'zoneAnalysisDetail.categoryFarmacia' },
  { denueSearchTerm: 'gasolinera', radiusMeters: 1500, labelKey: 'zoneAnalysisDetail.categoryGasolinera' }
];
