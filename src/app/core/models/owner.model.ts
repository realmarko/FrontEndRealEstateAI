export interface Owner {
  id: number;
  isOwnProfile: boolean;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  bio?: string;
  propertiesCount: number;
  viewCount: number;
}

export interface OwnerProfileInput {
  phone: string;
  photo?: File;
  bio?: string;
}

export interface OwnerFilters {
  name?: string;
}
