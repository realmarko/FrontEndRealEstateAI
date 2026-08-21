export type ListingType = 'sale' | 'rent';

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  type: ListingType;
  address: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  imageUrl: string;
  ownerId: string;
  createdAt: string;
}

export type ListingInput = Omit<Listing, 'id' | 'ownerId' | 'createdAt'>;
