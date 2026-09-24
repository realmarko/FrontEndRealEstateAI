import {
  Listing,
  ListingInput,
  ListingType,
  LandTenureType,
  LotShapeType,
  PriceHistoryEntry,
  PropertyType,
  TopographyType,
  VialidadType
} from '../models/listing.model';

// Backend enums serialize as numbers when writing (Create/Update) but as
// their .ToString() name when reading (the DTOs use different representations).
// Exported so saved-search-api.adapter.ts can reuse the same mapping instead of
// maintaining a second copy that could silently drift out of sync with this one.
export const LISTING_TYPE_TO_NUMBER: Record<ListingType, number> = { sale: 0, rent: 1 };
export const LISTING_TYPE_FROM_STRING: Record<string, ListingType> = { Sale: 'sale', Rent: 'rent' };

export const PROPERTY_TYPE_TO_NUMBER: Record<PropertyType, number> = {
  house: 0,
  condoHouse: 2,
  apartment: 1,
  residentialLand: 6,
  ranch: 7,
  office: 8,
  industrialWarehouse: 9,
  commercialLand: 10,
  industrialStorage: 11,
  retailSpace: 12,
  building: 13,
  room: 14,
  commercialStorage: 15,
  industrialLand: 16,
  land: 4,
  commercial: 5
};
export const PROPERTY_TYPE_FROM_STRING: Record<string, PropertyType> = {
  House: 'house',
  Apartment: 'apartment',
  Condo: 'condoHouse',
  Townhouse: 'house',
  Land: 'land',
  Commercial: 'commercial',
  ResidentialLand: 'residentialLand',
  Ranch: 'ranch',
  Office: 'office',
  IndustrialWarehouse: 'industrialWarehouse',
  CommercialLand: 'commercialLand',
  IndustrialStorage: 'industrialStorage',
  RetailSpace: 'retailSpace',
  Building: 'building',
  Room: 'room',
  CommercialStorage: 'commercialStorage',
  IndustrialLand: 'industrialLand'
};

export const LAND_TENURE_TO_NUMBER: Record<LandTenureType, number> = {
  privado: 0,
  ejidal: 1,
  comunal: 2,
  enRegularizacion: 3
};
export const LAND_TENURE_FROM_STRING: Record<string, LandTenureType> = {
  Privado: 'privado',
  Ejidal: 'ejidal',
  Comunal: 'comunal',
  EnRegularizacion: 'enRegularizacion'
};

export const VIALIDAD_TYPE_TO_NUMBER: Record<VialidadType, number> = {
  avenidaPrincipal: 0,
  calleSecundaria: 1,
  privada: 2
};
export const VIALIDAD_TYPE_FROM_STRING: Record<string, VialidadType> = {
  AvenidaPrincipal: 'avenidaPrincipal',
  CalleSecundaria: 'calleSecundaria',
  Privada: 'privada'
};

export const LOT_SHAPE_TO_NUMBER: Record<LotShapeType, number> = { regular: 0, irregular: 1 };
export const LOT_SHAPE_FROM_STRING: Record<string, LotShapeType> = { Regular: 'regular', Irregular: 'irregular' };

export const TOPOGRAPHY_TO_NUMBER: Record<TopographyType, number> = { plana: 0, inclinada: 1 };
export const TOPOGRAPHY_FROM_STRING: Record<string, TopographyType> = { Plana: 'plana', Inclinada: 'inclinada' };

const SQM_PER_SQFT = 0.09290304;

export interface ListingDto {
  id: string;
  title: string;
  description: string;
  listingType: string;
  propertyType: string;
  status: string;
  price: number;
  currency: string;
  street: string;
  colonia: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  yearBuilt: number | null;
  parkingSpaces: number | null;
  floors: number | null;
  lotSizeSqm: number | null;
  gardenSizeSqm: number | null;
  hasHeatingCooling: boolean;
  hoaFee: number | null;
  videoTourUrl: string | null;
  landUseZoning: string | null;
  landTenure: string | null;
  cosCoefficient: number | null;
  cusCoefficient: number | null;
  maxHeightMeters: number | null;
  isFreeOfLiens: boolean | null;
  hasPropertyTaxDebt: boolean | null;
  hasWaterDebt: boolean | null;
  frontageWidthMeters: number | null;
  frontageDepthMeters: number | null;
  hasPotableWater: boolean | null;
  hasDrainage: boolean | null;
  hasElectricity: boolean | null;
  hasThreePhaseElectricity: boolean | null;
  hasTelecomService: boolean | null;
  hasVehicleAccess: boolean | null;
  hasNearbyUTurn: boolean | null;
  isCornerLot: boolean | null;
  streetFrontageCount: number | null;
  primaryVialidadType: string | null;
  lotShape: string | null;
  topography: string | null;
  isFloodRiskZone: boolean | null;
  cadastralValue: number | null;
  ownerId: string;
  ownerName: string;
  ownerCompany: string | null;
  createdAt: string;
  imageUrls: string[];
}

export interface ListingPriceHistoryDto {
  price: number;
  currency: string;
  recordedAt: string;
}

export function priceHistoryFromDto(dto: ListingPriceHistoryDto): PriceHistoryEntry {
  return {
    price: dto.price,
    currency: dto.currency as Listing['currency'],
    recordedAt: dto.recordedAt
  };
}

export function fromDto(dto: ListingDto): Listing {
  const hasLocation = dto.latitude !== 0 || dto.longitude !== 0;

  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    price: dto.price,
    currency: dto.currency as Listing['currency'],
    type: LISTING_TYPE_FROM_STRING[dto.listingType] ?? 'rent',
    propertyType: PROPERTY_TYPE_FROM_STRING[dto.propertyType] ?? 'house',
    street: dto.street,
    colonia: dto.colonia,
    city: dto.city,
    state: dto.state,
    zipCode: dto.zipCode,
    country: dto.country,
    // Short display line: street + colonia + city + state, skipping empty parts (colonia is
    // blank for listings migrated before this field existed) — zip/country aren't shown inline.
    address: [dto.street, dto.colonia, dto.city, dto.state].filter((part) => part.trim().length > 0).join(', '),
    bedrooms: dto.bedrooms,
    bathrooms: dto.bathrooms,
    areaSqm: Math.round(dto.areaSqFt * SQM_PER_SQFT),
    yearBuilt: dto.yearBuilt ?? undefined,
    parkingSpaces: dto.parkingSpaces ?? undefined,
    floors: dto.floors ?? undefined,
    lotSizeSqm: dto.lotSizeSqm ?? undefined,
    gardenSizeSqm: dto.gardenSizeSqm ?? undefined,
    hasHeatingCooling: dto.hasHeatingCooling,
    hoaFee: dto.hoaFee ?? undefined,
    videoTourUrl: dto.videoTourUrl ?? undefined,
    landUseZoning: dto.landUseZoning ?? undefined,
    landTenure: dto.landTenure ? LAND_TENURE_FROM_STRING[dto.landTenure] : undefined,
    cosCoefficient: dto.cosCoefficient ?? undefined,
    cusCoefficient: dto.cusCoefficient ?? undefined,
    maxHeightMeters: dto.maxHeightMeters ?? undefined,
    isFreeOfLiens: dto.isFreeOfLiens ?? undefined,
    hasPropertyTaxDebt: dto.hasPropertyTaxDebt ?? undefined,
    hasWaterDebt: dto.hasWaterDebt ?? undefined,
    frontageWidthMeters: dto.frontageWidthMeters ?? undefined,
    frontageDepthMeters: dto.frontageDepthMeters ?? undefined,
    hasPotableWater: dto.hasPotableWater ?? undefined,
    hasDrainage: dto.hasDrainage ?? undefined,
    hasElectricity: dto.hasElectricity ?? undefined,
    hasThreePhaseElectricity: dto.hasThreePhaseElectricity ?? undefined,
    hasTelecomService: dto.hasTelecomService ?? undefined,
    hasVehicleAccess: dto.hasVehicleAccess ?? undefined,
    hasNearbyUTurn: dto.hasNearbyUTurn ?? undefined,
    isCornerLot: dto.isCornerLot ?? undefined,
    streetFrontageCount: dto.streetFrontageCount ?? undefined,
    primaryVialidadType: dto.primaryVialidadType ? VIALIDAD_TYPE_FROM_STRING[dto.primaryVialidadType] : undefined,
    lotShape: dto.lotShape ? LOT_SHAPE_FROM_STRING[dto.lotShape] : undefined,
    topography: dto.topography ? TOPOGRAPHY_FROM_STRING[dto.topography] : undefined,
    isFloodRiskZone: dto.isFloodRiskZone ?? undefined,
    cadastralValue: dto.cadastralValue ?? undefined,
    ownerCompany: dto.ownerCompany ?? undefined,
    // No fallback here on purpose — a listing with zero real photos should stay an empty
    // array. Substituting a stock photo would let it round-trip back to the server as if it
    // were a real, saved image the next time this listing is edited. Consumers that render a
    // single image (the card, the map marker) fall back to DEFAULT_LISTING_IMAGE themselves,
    // for display only.
    imageUrls: dto.imageUrls,
    ownerId: dto.ownerId,
    createdAt: dto.createdAt,
    lat: hasLocation ? dto.latitude : undefined,
    lng: hasLocation ? dto.longitude : undefined
  };
}

// Builds a multipart FormData body matching [FromForm] ListingCreateDto/ListingUpdateDto —
// existingImageUrls and photos are appended as repeated same-named fields so ASP.NET Core
// binds them back into List<string>/List<IFormFile>. `status` is only set on updates.
export function toFormData(input: ListingInput, status?: number): FormData {
  const form = new FormData();

  form.append('title', input.title);
  form.append('description', input.description);
  form.append('listingType', String(LISTING_TYPE_TO_NUMBER[input.type]));
  form.append('propertyType', String(PROPERTY_TYPE_TO_NUMBER[input.propertyType ?? 'house']));
  form.append('price', String(input.price));
  form.append('currency', input.currency);
  form.append('street', input.street);
  form.append('colonia', input.colonia);
  form.append('city', input.city);
  form.append('state', input.state);
  form.append('zipCode', input.zipCode);
  form.append('country', input.country);
  form.append('latitude', String(input.lat ?? 0));
  form.append('longitude', String(input.lng ?? 0));
  form.append('bedrooms', String(input.bedrooms));
  form.append('bathrooms', String(input.bathrooms));
  form.append('areaSqFt', String(Math.round(input.areaSqm / SQM_PER_SQFT)));
  if (input.yearBuilt != null) form.append('yearBuilt', String(input.yearBuilt));
  if (input.parkingSpaces != null) form.append('parkingSpaces', String(input.parkingSpaces));
  if (input.floors != null) form.append('floors', String(input.floors));
  if (input.lotSizeSqm != null) form.append('lotSizeSqm', String(input.lotSizeSqm));
  if (input.gardenSizeSqm != null) form.append('gardenSizeSqm', String(input.gardenSizeSqm));
  form.append('hasHeatingCooling', String(input.hasHeatingCooling));
  if (input.hoaFee != null) form.append('hoaFee', String(input.hoaFee));
  if (input.videoTourUrl) form.append('videoTourUrl', input.videoTourUrl);
  if (input.landUseZoning) form.append('landUseZoning', input.landUseZoning);
  if (input.landTenure != null) form.append('landTenure', String(LAND_TENURE_TO_NUMBER[input.landTenure]));
  if (input.cosCoefficient != null) form.append('cosCoefficient', String(input.cosCoefficient));
  if (input.cusCoefficient != null) form.append('cusCoefficient', String(input.cusCoefficient));
  if (input.maxHeightMeters != null) form.append('maxHeightMeters', String(input.maxHeightMeters));
  if (input.isFreeOfLiens != null) form.append('isFreeOfLiens', String(input.isFreeOfLiens));
  if (input.hasPropertyTaxDebt != null) form.append('hasPropertyTaxDebt', String(input.hasPropertyTaxDebt));
  if (input.hasWaterDebt != null) form.append('hasWaterDebt', String(input.hasWaterDebt));
  if (input.frontageWidthMeters != null) form.append('frontageWidthMeters', String(input.frontageWidthMeters));
  if (input.frontageDepthMeters != null) form.append('frontageDepthMeters', String(input.frontageDepthMeters));
  if (input.hasPotableWater != null) form.append('hasPotableWater', String(input.hasPotableWater));
  if (input.hasDrainage != null) form.append('hasDrainage', String(input.hasDrainage));
  if (input.hasElectricity != null) form.append('hasElectricity', String(input.hasElectricity));
  if (input.hasThreePhaseElectricity != null) form.append('hasThreePhaseElectricity', String(input.hasThreePhaseElectricity));
  if (input.hasTelecomService != null) form.append('hasTelecomService', String(input.hasTelecomService));
  if (input.hasVehicleAccess != null) form.append('hasVehicleAccess', String(input.hasVehicleAccess));
  if (input.hasNearbyUTurn != null) form.append('hasNearbyUTurn', String(input.hasNearbyUTurn));
  if (input.isCornerLot != null) form.append('isCornerLot', String(input.isCornerLot));
  if (input.streetFrontageCount != null) form.append('streetFrontageCount', String(input.streetFrontageCount));
  if (input.primaryVialidadType != null) form.append('primaryVialidadType', String(VIALIDAD_TYPE_TO_NUMBER[input.primaryVialidadType]));
  if (input.lotShape != null) form.append('lotShape', String(LOT_SHAPE_TO_NUMBER[input.lotShape]));
  if (input.topography != null) form.append('topography', String(TOPOGRAPHY_TO_NUMBER[input.topography]));
  if (input.isFloodRiskZone != null) form.append('isFloodRiskZone', String(input.isFloodRiskZone));
  if (input.cadastralValue != null) form.append('cadastralValue', String(input.cadastralValue));
  if (status !== undefined) form.append('status', String(status));

  input.existingImageUrls.forEach((url) => form.append('existingImageUrls', url));
  input.photos.forEach((file) => form.append('photos', file, file.name));

  return form;
}
