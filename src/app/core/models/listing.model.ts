export type ListingType = 'sale' | 'rent';
export type PropertyType =
  | 'house'
  | 'condoHouse'
  | 'apartment'
  | 'residentialLand'
  | 'ranch'
  | 'office'
  | 'industrialWarehouse'
  | 'commercialLand'
  | 'industrialStorage'
  | 'retailSpace'
  | 'building'
  | 'room'
  | 'commercialStorage'
  | 'industrialLand'
  | 'land'
  | 'commercial'
  | 'shoppingPlaza';
// Single source of truth for the property-type dropdown, shared by the listing form and the
// map filter — each option's label lives at `listingForm.<value>` in the i18n files.
// 'commercial', 'commercialLand', and 'industrialLand' are deliberately excluded: 'commercial'
// duplicated 'commercialLand' ("Terreno comercial") with no distinct meaning of its own, and
// 'commercialLand'/'industrialLand' were removed from the picker by request. Kept out of
// PropertyType's selectable options but not out of the type/i18n/mapping entirely, so any
// pre-existing listing that already has one of these values keeps reading, editing, and
// displaying correctly — only new listings can no longer choose them.
export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [
  'house',
  'condoHouse',
  'apartment',
  'residentialLand',
  'ranch',
  'office',
  'industrialWarehouse',
  'industrialStorage',
  'retailSpace',
  'building',
  'room',
  'commercialStorage',
  'land',
  'shoppingPlaza'
];

// For filtering existing listings (map, search), not creating new ones — unlike
// PROPERTY_TYPE_OPTIONS, this includes 'commercial'/'commercialLand'/'industrialLand' so a
// pre-existing listing with one of those values can still be found by filtering for its exact
// type, not just 'all'.
export const PROPERTY_TYPE_FILTER_OPTIONS: PropertyType[] = [
  ...PROPERTY_TYPE_OPTIONS,
  'commercial',
  'commercialLand',
  'industrialLand'
];

export type Currency = 'MXN' | 'USD';

// PropertyType values with no residential dwelling of their own — raw land, and commercial/
// industrial structures (office, retail, storage, warehouse). These get the land/commercial
// characteristics section and the ROI calculator; bedrooms/bathrooms/garden/HOA (residential-
// dwelling-only concepts) are hidden for all of them. 'commercial' stays in this list (even
// though it's no longer selectable — see PROPERTY_TYPE_OPTIONS) so a pre-existing listing with
// that value still gets the right sections.
export const LAND_OR_COMMERCIAL_PROPERTY_TYPES: PropertyType[] = [
  'land',
  'commercial',
  'residentialLand',
  'commercialLand',
  'industrialLand',
  'office',
  'retailSpace',
  'building',
  'commercialStorage',
  'industrialStorage',
  'industrialWarehouse',
  'shoppingPlaza'
];

// Subset of the above with no structure at all — raw land only. Also hides parking/floors/
// year-built/heating-cooling (structure-only concepts), on top of the residential-dwelling
// fields every LAND_OR_COMMERCIAL_PROPERTY_TYPES member already hides.
export const PURE_LAND_PROPERTY_TYPES: PropertyType[] = ['land', 'residentialLand', 'commercialLand', 'industrialLand'];

// Single source of truth for the gate — used by both the form (which section to show) and
// listing-detail (whether to show the ROI calculator), so the two can't drift out of sync.
export function isLandOrCommercialPropertyType(propertyType: PropertyType | null | undefined): boolean {
  return propertyType != null && LAND_OR_COMMERCIAL_PROPERTY_TYPES.includes(propertyType);
}

export function isPureLandPropertyType(propertyType: PropertyType | null | undefined): boolean {
  return propertyType != null && PURE_LAND_PROPERTY_TYPES.includes(propertyType);
}

// Property types with individual living rooms (cocina/sala/comedor) and the amenities section
// below — a single dwelling unit, as opposed to raw land/commercial-industrial structures or a
// single rented room.
export const HOUSE_OR_APARTMENT_PROPERTY_TYPES: PropertyType[] = ['house', 'condoHouse', 'apartment'];

export function isHouseOrApartmentPropertyType(propertyType: PropertyType | null | undefined): boolean {
  return propertyType != null && HOUSE_OR_APARTMENT_PROPERTY_TYPES.includes(propertyType);
}

export type LandTenureType = 'privado' | 'ejidal' | 'comunal' | 'enRegularizacion';
export type VialidadType = 'avenidaPrincipal' | 'calleSecundaria' | 'privada';
export type LotShapeType = 'regular' | 'irregular';
export type TopographyType = 'plana' | 'inclinada';
export type ConstructionConditionType = 'nueva' | 'usada' | 'remodelada' | 'enObra';
export type CardinalOrientationType =
  | 'norte'
  | 'sur'
  | 'este'
  | 'oeste'
  | 'noreste'
  | 'noroeste'
  | 'sureste'
  | 'suroeste';

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  priceOnRequest?: boolean;
  currency: Currency;
  type: ListingType;
  propertyType?: PropertyType;
  // Structured fields the form edits directly.
  street: string;
  colonia: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  // Derived, read-only display string built by fromDto() (listing-api.adapter.ts) by joining the
  // fields above — never submitted by the form (see ListingInput's Omit list below). Used by the
  // card, the detail page, the map popup, and the free-text search in listing-list/map-view.
  address: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  yearBuilt?: number;
  parkingSpaces?: number;
  parkingIsCovered?: boolean;
  floors?: number;
  lotSizeSqm?: number;
  gardenSizeSqm?: number;
  hasHeatingCooling: boolean;
  hasRoofGarden: boolean;
  hoaFee?: number;
  videoTourUrl?: string;
  constructionCondition?: ConstructionConditionType;
  facadeOrientation?: CardinalOrientationType;
  hasNaturalGas?: boolean;
  hasLpGas?: boolean;
  hasCistern?: boolean;
  cisternCapacityLiters?: number;
  hasWell?: boolean;
  hasKitchen?: boolean;
  hasLivingRoom?: boolean;
  hasDiningRoom?: boolean;
  hasPool?: boolean;
  hasTerrace?: boolean;
  hasBalcony?: boolean;
  hasServiceRoom?: boolean;
  hasLaundryArea?: boolean;
  hasStorageRoom?: boolean;
  hasGym?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  hasBbqArea?: boolean;
  landUseZoning?: string;
  landUseCategoryId?: number;
  landTenure?: LandTenureType;
  hasEjidalCertificate?: boolean;
  cosCoefficient?: number;
  cusCoefficient?: number;
  maxHeightMeters?: number;
  isFreeOfLiens?: boolean;
  hasPropertyTaxDebt?: boolean;
  hasWaterDebt?: boolean;
  frontageWidthMeters?: number;
  frontageDepthMeters?: number;
  commercialUnitCount?: number;
  hasApartmentUnit?: boolean;
  hasPotableWater?: boolean;
  hasDrainage?: boolean;
  hasElectricity?: boolean;
  hasThreePhaseElectricity?: boolean;
  hasTelecomService?: boolean;
  hasVehicleAccess?: boolean;
  hasPavedStreet?: boolean;
  hasNearbyUTurn?: boolean;
  isCornerLot?: boolean;
  streetFrontageCount?: number;
  primaryVialidadType?: VialidadType;
  lotShape?: LotShapeType;
  topography?: TopographyType;
  isFloodRiskZone?: boolean;
  cadastralValue?: number;
  ownerCompany?: string;
  imageUrls: string[];
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhotoUrl?: string;
  createdAt: string;
  lat?: number;
  lng?: number;
  viewCount: number;
  // Admin-only override (ListingsController.UpdateOwnerContact) — when true, listing-detail shows
  // ownerContact*'s free-text info instead of the agent card built from ownerName/ownerEmail
  // above. Edited through its own endpoint, not the regular create/update form (see ListingInput's
  // Omit below), since it needs admin authorization regardless of who owns the listing.
  hideAgentContact: boolean;
  ownerContactName?: string;
  ownerContactPhone?: string;
  ownerContactEmail?: string;
}

// The write model splits photos in two: URLs already hosted somewhere (pasted external links,
// or S3 URLs kept from a previous edit) vs. raw File objects the browser just picked, which the
// backend uploads to S3 itself — see ListingsController.BuildImageUrlsAsync.
export type ListingInput = Omit<
  Listing,
  | 'id'
  | 'ownerId'
  | 'ownerName'
  | 'ownerEmail'
  | 'ownerPhotoUrl'
  | 'createdAt'
  | 'imageUrls'
  | 'address'
  | 'viewCount'
  | 'hideAgentContact'
  | 'ownerContactName'
  | 'ownerContactPhone'
  | 'ownerContactEmail'
> & {
  existingImageUrls: string[];
  photos: File[];
};

// ListingsController.UpdateOwnerContact's own payload shape — admin-only, submitted separately
// from the regular ListingInput update (see listing-form.component.ts).
export interface ListingOwnerContactInput {
  hideAgentContact: boolean;
  ownerContactName?: string;
  ownerContactPhone?: string;
  ownerContactEmail?: string;
}

// Display-only fallback for a listing with zero real photos — never write this into a
// Listing's own imageUrls, or a fake stock photo could round-trip back to the server as if
// it were real (see fromDto in listing-api.adapter.ts).
export const DEFAULT_LISTING_IMAGE = 'https://picsum.photos/640/400';

export interface PriceHistoryEntry {
  price: number;
  currency: Currency;
  recordedAt: string;
}

export interface ListingQuota {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface CmaStats {
  count: number;
  minPrice?: number;
  maxPrice?: number;
  avgPricePerSqFt?: number;
  medianPricePerSqFt?: number;
  avgDaysOnMarket?: number;
}

export interface CmaResult {
  sale: CmaStats;
  rent: CmaStats;
  comparables: Listing[];
}

export interface ViabilityCheck {
  label: string;
  // true = meets the criterion, false = fails it, null = not applicable/not evaluated for this
  // business type (e.g. a population check where no census data covers this point).
  passed: boolean | null;
  detail: string;
}

export interface NearbyBusiness {
  name: string;
  distanceMeters: number;
  lat: number;
  lng: number;
}

export interface TrafficGenerator extends NearbyBusiness {
  category: string;
}

export interface NearbyRoad {
  name: string | null;
  classification: string;
  distanceMeters: number;
  lat: number;
  lng: number;
  // The road's own shape near this point (from OSM), for drawing it highlighted on the map —
  // empty when no geometry came back for it.
  geometry: { lat: number; lng: number }[];
}

export interface BusinessViability {
  key: string;
  displayName: string;
  score: number;
  // Set when a hard-blocker (flood risk, unresolved liens/debts) caps the score below what the
  // passed/applicable ratio alone would give.
  scoreCapReason: string | null;
  checks: ViabilityCheck[];
  nearbyCompetitors: NearbyBusiness[];
}

export interface ViabilityAnalysis {
  lat: number;
  lng: number;
  populationInRadius: number | null;
  socioeconomicScore: number | null;
  populationDataAvailable: boolean;
  businesses: BusinessViability[];
  trafficGenerators: TrafficGenerator[];
  nearbyRoads: NearbyRoad[];
  // True when the lookup itself failed (e.g. OpenStreetMap/Overpass down) rather than genuinely
  // finding nothing nearby — an empty list looks identical either way otherwise.
  roadsDataUnavailable: boolean;
  trafficGeneratorsDataUnavailable: boolean;
  // Real-time congestion snapshot (Google Routes API) for the nearest major road — 0/1/2 =
  // Low/Moderate/High (TrafficCongestionLevel's own numeric order on the backend), null when no
  // nearby road had geometry to measure or the lookup failed (see trafficDataUnavailable).
  trafficCongestionLevel: 0 | 1 | 2 | null;
  trafficCongestionRoadName: string | null;
  trafficDataUnavailable: boolean;
}

// Best-effort extraction from a pasted classified-ad text (/listings/new's "paste and
// autofill"), used to patchValue() the form — every field nullable/absent by design, since this
// is a draft the owner must still review, not a validated listing. See ListingDraftParsingService
// on the backend for what makes a field confident enough to fill vs. left out.
export interface ListingDraft {
  title: string | null;
  listingType: ListingType | null;
  propertyType: PropertyType | null;
  price: number | null;
  currency: Currency | null;
  colonia: string | null;
  city: string | null;
  state: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  lotSizeSqm: number | null;
  parkingSpaces: number | null;
  floors: number | null;
  yearBuilt: number | null;
  constructionCondition: ConstructionConditionType | null;
  hasPool: boolean | null;
  hasRoofGarden: boolean | null;
  hasTerrace: boolean | null;
  hasLaundryArea: boolean | null;
  hasCistern: boolean | null;
  cisternCapacityLiters: number | null;
  hasNaturalGas: boolean | null;
  hasLpGas: boolean | null;
  hasSecurity: boolean | null;
  hasElevator: boolean | null;
  hasGym: boolean | null;
  hasBbqArea: boolean | null;
  hasServiceRoom: boolean | null;
  hasStorageRoom: boolean | null;
  hasPropertyTaxDebt: boolean | null;
  // Resolved from a Google Maps link in the pasted text (see GoogleMapsLinkResolverService on
  // the backend), not from the ad's own wording — null when no Maps link was found in the text,
  // or the link couldn't be resolved to a real location.
  lat: number | null;
  lng: number | null;
  // True when the text had a Google Maps link that couldn't be turned into coordinates (broken
  // link, unsupported share format, failed lookup) — distinct from lat/lng simply being null
  // because there was no link at all, so the form can warn instead of silently doing nothing.
  mapsLinkResolutionFailed: boolean;
}
