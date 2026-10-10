import { Agency, AgencyMapItem } from '../models/agency.model';

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
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  workingHours?: string | null;
  agentsCount: number;
  listingsCount: number;
  canEdit: boolean;
}

// Every link to a brokerage's detail page is built with this instead of the numeric id (see
// AgencyDetailComponent, which resolves '/inmobiliarias/:id' via GET /api/brokerages/by-slug/...
// — BrokeragesController.GetBySlug does the same `Replace(" ", "_")` server-side so the two stay
// in lockstep without sharing code across the frontend/backend boundary).
export function toSlug(name: string): string {
  return name.replace(/ /g, '_');
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
    latitude: dto.latitude ?? undefined,
    longitude: dto.longitude ?? undefined,
    address: dto.address ?? undefined,
    phone: dto.phone ?? undefined,
    email: dto.email ?? undefined,
    workingHours: dto.workingHours ?? undefined,
    agentsCount: dto.agentsCount,
    listingsCount: dto.listingsCount,
    canEdit: dto.canEdit
  };
}

export interface BrokerageMapItemDto {
  id: number;
  name: string;
  logoUrl?: string | null;
  latitude: number;
  longitude: number;
}

export function mapItemFromDto(dto: BrokerageMapItemDto): AgencyMapItem {
  return {
    id: dto.id,
    name: dto.name,
    logoUrl: dto.logoUrl ?? undefined,
    latitude: dto.latitude,
    longitude: dto.longitude
  };
}
