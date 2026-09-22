import { Listing } from './listing.model';

// Kept as the exact PascalCase strings the backend's .ToString() sends (see
// FraccionamientosController), not translated to camelCase — unlike Listing's enums, nothing here
// is ever sent back as a raw int (the status filter binds from the string name too), so there's no
// numeric mapping to keep in sync.
export type FraccionamientoStatus = 'Candidate' | 'UnderReview' | 'Published' | 'Rejected' | 'MergedInto';
export type FraccionamientoSourceType =
  | 'Ruv'
  | 'Lamudi'
  | 'Inmuebles24'
  | 'Vivanuncios'
  | 'DeveloperSite'
  | 'MunicipalGazette'
  | 'Satellite'
  | 'ManualAdmin';

export interface FraccionamientoListItem {
  id: string;
  name: string;
  developerName: string | null;
  city: string;
  state: string;
  status: FraccionamientoStatus;
  sourceCount: number;
  firstDetectedAt: string;
  publishedAt: string | null;
}

export interface FraccionamientoSource {
  id: string;
  sourceType: FraccionamientoSourceType;
  sourceUrl: string | null;
  detectedAt: string;
}

export interface FraccionamientoDetail {
  id: string;
  name: string;
  developerName: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  stage: string | null;
  status: FraccionamientoStatus;
  description: string | null;
  amenitiesJson: string | null;
  masterPlanImageUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  firstDetectedAt: string;
  publishedAt: string | null;
  linkedListingCount: number;
  sources: FraccionamientoSource[];
}

export interface PagedFraccionamientos {
  items: FraccionamientoListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// Body for POST /api/fraccionamientos (admin "add manually" form).
export interface CreateFraccionamientoInput {
  name: string;
  developerName: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  stage: string | null;
}

export interface CreateFraccionamientoResult {
  id: string;
  matchedExisting: boolean;
}

export interface ApproveFraccionamientoInput {
  name: string;
  developerName: string | null;
  city: string;
  state: string;
  stage: string | null;
  description: string | null;
  amenitiesJson: string | null;
  masterPlanImageUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

// Public shapes, kept separate from the admin ones above: no status/sourceCount/firstDetectedAt
// (detection-internal, never meaningful to a visitor), and listings is already the frontend
// Listing[] shape (mapped via fromDto in FraccionamientoService), not raw ListingDtos.
export interface FraccionamientoPublicListItem {
  id: string;
  name: string;
  developerName: string | null;
  city: string;
  state: string;
  stage: string | null;
  masterPlanImageUrl: string | null;
  publishedAt: string | null;
  latitude: number;
  longitude: number;
}

export interface PagedFraccionamientosPublic {
  items: FraccionamientoPublicListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface FraccionamientoPublicDetail {
  id: string;
  name: string;
  developerName: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  stage: string | null;
  description: string | null;
  amenitiesJson: string | null;
  masterPlanImageUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  publishedAt: string | null;
  listings: Listing[];
}
