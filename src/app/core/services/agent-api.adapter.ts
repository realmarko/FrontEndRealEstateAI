import { Agent, AgentReview } from '../models/agent.model';

export interface AgentDto {
  id: number;
  isOwnProfile: boolean;
  name: string;
  email: string;
  phone: string;
  company?: string | null;
  isIndependent: boolean;
  photoUrl?: string | null;
  bio?: string | null;
  specialties: string[];
  propertiesCount: number;
  averageRating?: number | null;
  reviewsCount: number;
}

export function fromDto(dto: AgentDto): Agent {
  return {
    id: dto.id,
    isOwnProfile: dto.isOwnProfile,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    company: dto.company ?? undefined,
    isIndependent: dto.isIndependent,
    photoUrl: dto.photoUrl ?? undefined,
    bio: dto.bio ?? undefined,
    specialties: dto.specialties ?? [],
    propertiesCount: dto.propertiesCount,
    averageRating: dto.averageRating ?? undefined,
    reviewsCount: dto.reviewsCount
  };
}

export interface AgentReviewDto {
  id: number;
  reviewerName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export function reviewFromDto(dto: AgentReviewDto): AgentReview {
  return {
    id: dto.id,
    reviewerName: dto.reviewerName,
    rating: dto.rating,
    comment: dto.comment ?? undefined,
    createdAt: dto.createdAt
  };
}
