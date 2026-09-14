export type ListingType = 'sale' | 'rent';
export type PropertyType = 'house' | 'apartment' | 'land' | 'commercial';
export type Currency = 'MXN' | 'USD';

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
