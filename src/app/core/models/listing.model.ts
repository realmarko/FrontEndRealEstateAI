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
  | 'commercial';
// Single source of truth for the property-type dropdown, shared by the listing form and the
// map filter — each option's label lives at `listingForm.<value>` in the i18n files.
// 'commercial' is deliberately excluded: it duplicated 'commercialLand' ("Terreno comercial")
// with no distinct meaning of its own. Kept out of PropertyType's selectable options but not
// out of the type/i18n/mapping entirely, so any pre-existing listing that already has this
// value keeps reading, editing, and displaying correctly — only new listings can no longer
// choose it.
export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [
  'house',
  'condoHouse',
  'apartment',
  'residentialLand',
  'ranch',
  'office',
  'industrialWarehouse',
  'commercialLand',
  'industrialStorage',
  'retailSpace',
  'building',
  'room',
  'commercialStorage',
  'industrialLand',
  'land'
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
  'industrialWarehouse'
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

export type LandTenureType = 'privado' | 'ejidal' | 'comunal' | 'enRegularizacion';
export type VialidadType = 'avenidaPrincipal' | 'calleSecundaria' | 'privada';
export type LotShapeType = 'regular' | 'irregular';
export type TopographyType = 'plana' | 'inclinada';

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  type: ListingType;
  propertyType?: PropertyType;
  address: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  yearBuilt?: number;
  parkingSpaces?: number;
  floors?: number;
  lotSizeSqm?: number;
  gardenSizeSqm?: number;
  hasHeatingCooling: boolean;
  hoaFee?: number;
  videoTourUrl?: string;
  landUseZoning?: string;
  landTenure?: LandTenureType;
  cosCoefficient?: number;
  cusCoefficient?: number;
  maxHeightMeters?: number;
  isFreeOfLiens?: boolean;
  hasPropertyTaxDebt?: boolean;
  hasWaterDebt?: boolean;
  frontageWidthMeters?: number;
  frontageDepthMeters?: number;
  hasPotableWater?: boolean;
  hasDrainage?: boolean;
  hasElectricity?: boolean;
  hasThreePhaseElectricity?: boolean;
  hasTelecomService?: boolean;
  hasVehicleAccess?: boolean;
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
  createdAt: string;
  lat?: number;
  lng?: number;
}

// The write model splits photos in two: URLs already hosted somewhere (pasted external links,
// or S3 URLs kept from a previous edit) vs. raw File objects the browser just picked, which the
// backend uploads to S3 itself — see ListingsController.BuildImageUrlsAsync.
export type ListingInput = Omit<Listing, 'id' | 'ownerId' | 'createdAt' | 'imageUrls'> & {
  existingImageUrls: string[];
  photos: File[];
};

// Display-only fallback for a listing with zero real photos — never write this into a
// Listing's own imageUrls, or a fake stock photo could round-trip back to the server as if
// it were real (see fromDto in listing-api.adapter.ts).
export const DEFAULT_LISTING_IMAGE = 'https://picsum.photos/640/400';

export interface PriceHistoryEntry {
  price: number;
  currency: Currency;
  recordedAt: string;
}
