import { FundingMethod, Inquiry, InquiryInput, PurchaseTimeline } from '../models/inquiry.model';

// Backend enums serialize as numbers when writing but as their .ToString() name when reading —
// same convention as listing-api.adapter.ts's LISTING_TYPE_*/PROPERTY_TYPE_* maps.
const FUNDING_METHOD_TO_NUMBER: Record<FundingMethod, number> = {
  cash: 0,
  bankLoan: 1,
  infonavitFovissste: 2,
  notSure: 3
};
const FUNDING_METHOD_FROM_STRING: Record<string, FundingMethod> = {
  Cash: 'cash',
  BankLoan: 'bankLoan',
  InfonavitFovissste: 'infonavitFovissste',
  NotSure: 'notSure'
};

const TIMELINE_TO_NUMBER: Record<PurchaseTimeline, number> = {
  readyNow: 0,
  oneToThreeMonths: 1,
  threeToSixMonths: 2,
  justBrowsing: 3
};
const TIMELINE_FROM_STRING: Record<string, PurchaseTimeline> = {
  ReadyNow: 'readyNow',
  OneToThreeMonths: 'oneToThreeMonths',
  ThreeToSixMonths: 'threeToSixMonths',
  JustBrowsing: 'justBrowsing'
};

export interface InquiryDto {
  id: string;
  listingId: string;
  listingTitle: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  message: string;
  fundingMethod: string | null;
  timeline: string | null;
  hasAgent: boolean | null;
  isRead: boolean;
  createdAt: string;
}

export function fromDto(dto: InquiryDto): Inquiry {
  return {
    id: dto.id,
    listingId: dto.listingId,
    listingTitle: dto.listingTitle,
    senderName: dto.senderName,
    senderEmail: dto.senderEmail,
    senderPhone: dto.senderPhone ?? undefined,
    message: dto.message,
    fundingMethod: dto.fundingMethod ? FUNDING_METHOD_FROM_STRING[dto.fundingMethod] : undefined,
    timeline: dto.timeline ? TIMELINE_FROM_STRING[dto.timeline] : undefined,
    hasAgent: dto.hasAgent ?? undefined,
    isRead: dto.isRead,
    createdAt: dto.createdAt
  };
}

export function toCreateBody(input: InquiryInput): Record<string, unknown> {
  return {
    listingId: input.listingId,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    senderPhone: input.senderPhone ?? null,
    message: input.message,
    fundingMethod: input.fundingMethod ? FUNDING_METHOD_TO_NUMBER[input.fundingMethod] : null,
    timeline: input.timeline ? TIMELINE_TO_NUMBER[input.timeline] : null,
    hasAgent: input.hasAgent ?? null
  };
}
