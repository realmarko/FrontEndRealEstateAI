// camelCase union values, same convention as listing-api.adapter.ts's other enums — mapped to/from
// the backend's raw int (Create/Update bodies) and .ToString() PascalCase name (read responses) via
// the _TO_NUMBER/_FROM_STRING records in infrastructure-project.service.ts.
export type InfrastructureProjectType =
  | 'highwayExpansion'
  | 'newRoad'
  | 'industrialPark'
  | 'publicTransit'
  | 'hospital'
  | 'school'
  | 'other';

export type InfrastructureProjectStatus = 'announced' | 'inProgress' | 'completed' | 'cancelled';

export interface InfrastructureProjectPublic {
  id: string;
  name: string;
  description: string | null;
  type: InfrastructureProjectType;
  status: InfrastructureProjectStatus;
  latitude: number;
  longitude: number;
  affectedRadiusMeters: number;
  announcedDate: string;
  expectedCompletionDate: string | null;
  sourceUrl: string | null;
}

export interface InfrastructureProjectListItem {
  id: string;
  name: string;
  type: InfrastructureProjectType;
  status: InfrastructureProjectStatus;
  latitude: number;
  longitude: number;
  announcedDate: string;
  expectedCompletionDate: string | null;
}

export interface InfrastructureProjectDetail {
  id: string;
  name: string;
  description: string | null;
  type: InfrastructureProjectType;
  status: InfrastructureProjectStatus;
  latitude: number;
  longitude: number;
  affectedRadiusMeters: number;
  announcedDate: string;
  expectedCompletionDate: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PagedInfrastructureProjects {
  items: InfrastructureProjectListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// Body for POST/PUT — shared shape, same reasoning as InfrastructureProjectUpsertDto on the
// backend (every row is admin-entered from the start, no separate "raw candidate" stage).
export interface InfrastructureProjectUpsertInput {
  name: string;
  description: string | null;
  type: InfrastructureProjectType;
  status: InfrastructureProjectStatus;
  latitude: number;
  longitude: number;
  affectedRadiusMeters: number;
  announcedDate: string;
  expectedCompletionDate: string | null;
  sourceUrl: string | null;
}
