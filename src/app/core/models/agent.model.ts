export interface Agent {
  id: number;
  isOwnProfile: boolean;
  name: string;
  email: string;
  phone: string;
  // Primary brokerage name only — kept for display spots that show a single line (agent card,
  // SEO structured data). See companies below for the full list.
  company?: string;
  // Every brokerage this agent belongs to, primary first — an agent can now belong to more than
  // one (see agent-signup's multi-select).
  companies: string[];
  isIndependent: boolean;
  photoUrl?: string;
  bio?: string;
  specialties: string[];
  propertiesCount: number;
  averageRating?: number;
  reviewsCount: number;
  viewCount: number;
}

export interface AgentReview {
  id: number;
  reviewerName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface AgentProfileInput {
  phone: string;
  // Comma-separated — see AgentDtos.CreateAgentDto.Companies on the backend.
  companies?: string[];
  isIndependent?: boolean;
  photo?: File;
  bio?: string;
  specialties?: string[];
}

export interface AgentFilters {
  name?: string;
  specialty?: string;
  company?: string;
  minRating?: number;
}
