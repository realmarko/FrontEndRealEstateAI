import { Listing, ListingInput, ListingType, PropertyType } from '../models/listing.model';

// Backend enums serialize as numbers when writing (Create/Update) but as
// their .ToString() name when reading (the DTOs use different representations).
const LISTING_TYPE_TO_NUMBER: Record<ListingType, number> = { sale: 0, rent: 1 };
const LISTING_TYPE_FROM_STRING: Record<string, ListingType> = { Sale: 'sale', Rent: 'rent' };

const PROPERTY_TYPE_TO_NUMBER: Record<PropertyType, number> = {
  house: 0,
  apartment: 1,
  land: 4,
  commercial: 5
};
const PROPERTY_TYPE_FROM_STRING: Record<string, PropertyType> = {
  House: 'house',
  Apartment: 'apartment',
  Condo: 'apartment',
  Townhouse: 'house',
  Land: 'land',
  Commercial: 'commercial'
};

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
  addressLine: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  yearBuilt: number | null;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  imageUrls: string[];
}

export interface ListingCreateRequest {
  title: string;
  description: string;
  listingType: number;
  propertyType: number;
  price: number;
  currency: string;
  addressLine: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  yearBuilt: number | null;
  imageUrls: string[];
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
    address: dto.addressLine,
    bedrooms: dto.bedrooms,
    bathrooms: dto.bathrooms,
    areaSqm: Math.round(dto.areaSqFt * SQM_PER_SQFT),
    imageUrl: dto.imageUrls[0] ?? 'https://picsum.photos/640/400',
    ownerId: dto.ownerId,
    createdAt: dto.createdAt,
    lat: hasLocation ? dto.latitude : undefined,
    lng: hasLocation ? dto.longitude : undefined
  };
}

export function toCreateRequest(input: ListingInput): ListingCreateRequest {
  return {
    title: input.title,
    description: input.description,
    listingType: LISTING_TYPE_TO_NUMBER[input.type],
    propertyType: PROPERTY_TYPE_TO_NUMBER[input.propertyType ?? 'house'],
    price: input.price,
    currency: input.currency,
    addressLine: input.address,
    city: 'Puebla',
    state: 'Puebla',
    zipCode: '',
    latitude: input.lat ?? 0,
    longitude: input.lng ?? 0,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    areaSqFt: Math.round(input.areaSqm / SQM_PER_SQFT),
    yearBuilt: null,
    imageUrls: input.imageUrl ? [input.imageUrl] : []
  };
}
