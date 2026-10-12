import { Owner } from '../models/owner.model';

export interface OwnerDto {
  id: number;
  isOwnProfile: boolean;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string | null;
  bio?: string | null;
  propertiesCount: number;
  viewCount: number;
}

// Same convention as agent-api.adapter.ts's own toSlug (spaces stripped entirely, not
// underscore-replaced) — OwnersController.GetBySlug does the identical transform server-side.
export function toSlug(name: string): string {
  return name.replace(/ /g, '');
}

export function fromDto(dto: OwnerDto): Owner {
  return {
    id: dto.id,
    isOwnProfile: dto.isOwnProfile,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    photoUrl: dto.photoUrl ?? undefined,
    bio: dto.bio ?? undefined,
    propertiesCount: dto.propertiesCount,
    viewCount: dto.viewCount
  };
}
