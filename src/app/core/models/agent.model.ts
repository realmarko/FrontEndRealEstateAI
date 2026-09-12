export interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  isIndependent: boolean;
  photoUrl?: string;
  bio?: string;
  specialties: string[];
  propertiesCount: number;
  averageRating?: number;
  reviewsCount: number;
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
  company?: string;
  isIndependent?: boolean;
  photo?: File;
  bio?: string;
  specialties?: string[];
}
