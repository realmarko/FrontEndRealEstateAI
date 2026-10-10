export interface Agency {
  id: number;
  name: string;
  logoUrl?: string;
  state?: string;
  city?: string;
  website?: string;
  description?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  agentsCount: number;
  listingsCount: number;
  // True only for an agent whose own profile belongs to this agency — gates the
  // "Editar mi inmobiliaria" entry point (the real check is enforced server-side too).
  canEdit: boolean;
}

export interface AgencyProfileInput {
  state?: string;
  city?: string;
  website?: string;
  description?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  logo?: File;
}

// POST /api/brokerages — Admin-only, from the map's "Agregar inmobiliaria" tool.
export interface AgencyCreateInput {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  website?: string;
  photo?: File;
}

// PUT /api/brokerages/{id}/admin — Admin-only, every field (unlike AgencyProfileInput, which a
// member agent can use on only the subset of fields they're trusted to change).
export interface AgencyAdminUpdateInput {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  state?: string;
  city?: string;
  website?: string;
  description?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  logo?: File;
}

// GET /api/brokerages/map — the map's lightweight marker-layer shape, not a full Agency.
export interface AgencyMapItem {
  id: number;
  name: string;
  logoUrl?: string;
  latitude: number;
  longitude: number;
}

// POST /api/brokerages/import — bulk CSV upload result (/admin/inmobiliarias).
export interface AgencyImportResult {
  createdCount: number;
  errors: { rowNumber: number; message: string }[];
}

export interface AgencyFilters {
  name?: string;
  state?: string;
  city?: string;
}
