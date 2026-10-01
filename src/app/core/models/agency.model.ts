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

export interface AgencyFilters {
  name?: string;
  state?: string;
  city?: string;
}
