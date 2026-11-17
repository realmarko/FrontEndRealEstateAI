// Curated set of municipalities for the zone-analysis SEO pages — deliberately a fixed,
// hand-picked list (not every one of the 200+ municipalities GeomarketingService.municipalities
// returns per state) to keep DENUE lookups at build/request time small; see
// app.routes.server.ts's own reasoning for why viability/residential-analysis routes stay
// client-only. cvegeo matches GeomarketingService.MunicipalityListItem for the same municipality,
// useful if a future page wants to cross-reference it (e.g. getMunicipalityBoundary).
// lat/lng are each municipality's own urban center (not a population-weighted centroid), chosen so
// the AGEB-level population/business density lookups land in the actually built-up area — each
// one verified against the real population-density endpoint before being added here.
//
// `state` is limited to Puebla/Tlaxcala/Querétaro because that's where INEGI's AGEB-level census
// data is actually imported today (confirmed via population-density on 2026-11-16 — e.g. Mexico
// City, Guadalajara and Monterrey all 404 with "No population data covers this location yet.").
// DENUE business-density itself is national, but a zone page without any population/density
// numbers would be a much weaker page, so new zones stay within these 3 states until more AGEB
// data is imported.
export interface ZoneAnalysisZone {
  slug: string;
  cvegeo: string;
  name: string;
  state: 'Puebla' | 'Tlaxcala' | 'Querétaro';
  lat: number;
  lng: number;
}

export const ZONE_ANALYSIS_ZONES: readonly ZoneAnalysisZone[] = [
  { slug: 'puebla', cvegeo: '21114', name: 'Puebla', state: 'Puebla', lat: 19.0414, lng: -98.2063 },
  { slug: 'san-andres-cholula', cvegeo: '21119', name: 'San Andrés Cholula', state: 'Puebla', lat: 19.0558, lng: -98.2831 },
  { slug: 'san-pedro-cholula', cvegeo: '21140', name: 'San Pedro Cholula', state: 'Puebla', lat: 19.0636, lng: -98.3077 },
  { slug: 'cuautlancingo', cvegeo: '21041', name: 'Cuautlancingo', state: 'Puebla', lat: 19.0867, lng: -98.2436 },
  { slug: 'amozoc', cvegeo: '21015', name: 'Amozoc', state: 'Puebla', lat: 19.0317, lng: -98.0486 },
  { slug: 'san-martin-texmelucan', cvegeo: '21132', name: 'San Martín Texmelucan', state: 'Puebla', lat: 19.2822, lng: -98.4322 },
  { slug: 'atlixco', cvegeo: '21019', name: 'Atlixco', state: 'Puebla', lat: 18.9083, lng: -98.4342 },
  { slug: 'huejotzingo', cvegeo: '21074', name: 'Huejotzingo', state: 'Puebla', lat: 19.1517, lng: -98.4 },
  { slug: 'tlaxcala', cvegeo: '29033', name: 'Tlaxcala', state: 'Tlaxcala', lat: 19.3182, lng: -98.2375 },
  { slug: 'apizaco', cvegeo: '29005', name: 'Apizaco', state: 'Tlaxcala', lat: 19.4167, lng: -98.15 },
  { slug: 'huamantla', cvegeo: '29013', name: 'Huamantla', state: 'Tlaxcala', lat: 19.3167, lng: -97.9167 },
  { slug: 'chiautempan', cvegeo: '29010', name: 'Chiautempan', state: 'Tlaxcala', lat: 19.3167, lng: -98.1833 },
  { slug: 'totolac', cvegeo: '29036', name: 'Totolac', state: 'Tlaxcala', lat: 19.3336, lng: -98.2219 },
  { slug: 'tetla-de-la-solidaridad', cvegeo: '29031', name: 'Tetla de la Solidaridad', state: 'Tlaxcala', lat: 19.3658, lng: -98.1511 },
  { slug: 'queretaro', cvegeo: '22014', name: 'Querétaro', state: 'Querétaro', lat: 20.5888, lng: -100.3899 },
  { slug: 'san-juan-del-rio', cvegeo: '22016', name: 'San Juan del Río', state: 'Querétaro', lat: 20.3889, lng: -99.9961 },
  { slug: 'corregidora', cvegeo: '22006', name: 'Corregidora', state: 'Querétaro', lat: 20.5219, lng: -100.4397 },
  { slug: 'el-marques', cvegeo: '22011', name: 'El Marqués', state: 'Querétaro', lat: 20.6975, lng: -100.4486 }
];

export function findZoneBySlug(slug: string): ZoneAnalysisZone | undefined {
  return ZONE_ANALYSIS_ZONES.find((zone) => zone.slug === slug);
}

// Businesses whose DENUE search term the backend already whitelists (AllowedSearchTerms — see
// map-view.component.ts's OPPORTUNITY_CATEGORIES) and that double as the land-flipping niche's
// own buyer list (selling/renting vacant lots to OXXO, farmacias, gasolineras and gym chains like
// Smart Fit) — same term+radius pairing used there, kept in sync rather than invented fresh for
// this page.
export interface NicheBusinessCategory {
  denueSearchTerm: 'oxxo' | 'farmacia' | 'gasolinera' | 'gimnasio';
  radiusMeters: number;
  labelKey: string;
}

export const NICHE_BUSINESS_CATEGORIES: readonly NicheBusinessCategory[] = [
  { denueSearchTerm: 'oxxo', radiusMeters: 500, labelKey: 'zoneAnalysisDetail.categoryOxxo' },
  { denueSearchTerm: 'farmacia', radiusMeters: 1000, labelKey: 'zoneAnalysisDetail.categoryFarmacia' },
  { denueSearchTerm: 'gasolinera', radiusMeters: 1500, labelKey: 'zoneAnalysisDetail.categoryGasolinera' },
  // Same term + radius as map-view.component.ts's OPPORTUNITY_CATEGORIES 'gym' entry — Smart Fit's
  // aggressive 2026 expansion (~70 new locations) makes this a live niche buyer too, not just OXXO/
  // farmacia/gasolinera.
  { denueSearchTerm: 'gimnasio', radiusMeters: 1000, labelKey: 'zoneAnalysisDetail.categoryGimnasio' }
];
