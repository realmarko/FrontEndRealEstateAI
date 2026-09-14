import { SavedSearch, SavedSearchInput } from '../models/saved-search.model';
import {
  LISTING_TYPE_FROM_STRING,
  LISTING_TYPE_TO_NUMBER,
  PROPERTY_TYPE_FROM_STRING,
  PROPERTY_TYPE_TO_NUMBER
} from './listing-api.adapter';

export interface SavedSearchDto {
  id: string;
  name: string;
  listingType: string | null;
  propertyType: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  city: string | null;
  createdAt: string;
}

export function fromDto(dto: SavedSearchDto): SavedSearch {
  return {
    id: dto.id,
    name: dto.name,
    listingType: dto.listingType ? LISTING_TYPE_FROM_STRING[dto.listingType] : undefined,
    propertyType: dto.propertyType ? PROPERTY_TYPE_FROM_STRING[dto.propertyType] : undefined,
    minPrice: dto.minPrice ?? undefined,
    maxPrice: dto.maxPrice ?? undefined,
    minBedrooms: dto.minBedrooms ?? undefined,
    minBathrooms: dto.minBathrooms ?? undefined,
    city: dto.city ?? undefined,
    createdAt: dto.createdAt
  };
}

export function toCreateBody(input: SavedSearchInput): Record<string, unknown> {
  return {
    name: input.name,
    listingType: input.listingType ? LISTING_TYPE_TO_NUMBER[input.listingType] : null,
    propertyType: input.propertyType ? PROPERTY_TYPE_TO_NUMBER[input.propertyType] : null,
    minPrice: input.minPrice ?? null,
    maxPrice: input.maxPrice ?? null,
    minBedrooms: input.minBedrooms ?? null,
    minBathrooms: input.minBathrooms ?? null,
    city: input.city ?? null
  };
}
