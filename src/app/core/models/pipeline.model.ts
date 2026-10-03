export interface PipelineStage {
  id: number;
  name: string;
  description: string;
  sortOrder: number;
  requiresLegalReview: boolean;
}

export interface SaleProcessDocument {
  id: string;
  stageId: number;
  name: string;
  isVerified: boolean;
  verifiedAt?: string;
}

export interface SaleProcessTask {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface SaleProcessSummary {
  id: string;
  clientName: string;
  clientPhone: string;
  propertyAddress: string;
  estimatedPrice: number;
  listingId?: string;
  currentStageId: number;
  currentStageName: string;
  requiresLegalReview: boolean;
  documentsTotal: number;
  documentsVerified: number;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleProcessDetail extends SaleProcessSummary {
  documents: SaleProcessDocument[];
  tasks: SaleProcessTask[];
}

export interface SaleProcessCreateInput {
  clientName: string;
  clientPhone: string;
  propertyAddress: string;
  estimatedPrice: number;
  stageId?: number;
}

export interface PipelineMetrics {
  activeCount: number;
  totalValue: number;
  legalReviewCount: number;
  closedCount: number;
}
