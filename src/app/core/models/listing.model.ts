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
  imageUrl: string;
  ownerId: string;
  createdAt: string;
  lat?: number;
  lng?: number;
}

export type ListingInput = Omit<Listing, 'id' | 'ownerId' | 'createdAt'>;
