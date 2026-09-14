import { ListingType, PropertyType } from './listing.model';

export interface SavedSearch {
  id: string;
  name: string;
  listingType?: ListingType;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  city?: string;
  createdAt: string;
}

export type SavedSearchInput = Omit<SavedSearch, 'id' | 'createdAt'>;
