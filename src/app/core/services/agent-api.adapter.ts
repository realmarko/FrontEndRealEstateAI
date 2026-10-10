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
  viewCount: number;
}

// Every link to an agent's detail page is built with this instead of the numeric id (see
// AgentDetailComponent, which resolves '/agents/:id' via GET /api/agents/by-slug/... —
// AgentsController.GetBySlug does the same space-stripping server-side so the two stay in
// lockstep without sharing code across the frontend/backend boundary). Deliberately strips
// spaces entirely rather than replacing them with an underscore — BrokerageService's toSlug
// uses the underscore form; the two were asked for separately and intentionally differ.
export function toSlug(name: string): string {
  return name.replace(/ /g, '');
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
    reviewsCount: dto.reviewsCount,
    viewCount: dto.viewCount
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
