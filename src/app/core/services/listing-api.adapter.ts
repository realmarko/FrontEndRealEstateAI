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
    yearBuilt: dto.yearBuilt ?? undefined,
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
  form.append('addressLine', input.address);
  form.append('city', 'Puebla');
  form.append('state', 'Puebla');
  form.append('zipCode', '');
  form.append('latitude', String(input.lat ?? 0));
  form.append('longitude', String(input.lng ?? 0));
  form.append('bedrooms', String(input.bedrooms));
  form.append('bathrooms', String(input.bathrooms));
  form.append('areaSqFt', String(Math.round(input.areaSqm / SQM_PER_SQFT)));
  if (input.yearBuilt != null) form.append('yearBuilt', String(input.yearBuilt));
  if (status !== undefined) form.append('status', String(status));

  input.existingImageUrls.forEach((url) => form.append('existingImageUrls', url));
  input.photos.forEach((file) => form.append('photos', file, file.name));

  return form;
}
