import { Agency } from '../models/agency.model';

export interface BrokerageDto {
  id: number;
  name: string;
  logoUrl?: string | null;
  state?: string | null;
  city?: string | null;
  website?: string | null;
  description?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  agentsCount: number;
  listingsCount: number;
  canEdit: boolean;
}

export function fromDto(dto: BrokerageDto): Agency {
  return {
    id: dto.id,
    name: dto.name,
    logoUrl: dto.logoUrl ?? undefined,
    state: dto.state ?? undefined,
    city: dto.city ?? undefined,
    website: dto.website ?? undefined,
    description: dto.description ?? undefined,
    facebookUrl: dto.facebookUrl ?? undefined,
    instagramUrl: dto.instagramUrl ?? undefined,
    agentsCount: dto.agentsCount,
    listingsCount: dto.listingsCount,
    canEdit: dto.canEdit
  };
}
