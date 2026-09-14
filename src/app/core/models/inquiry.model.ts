export type FundingMethod = 'cash' | 'bankLoan' | 'infonavitFovissste' | 'notSure';
export type PurchaseTimeline = 'readyNow' | 'oneToThreeMonths' | 'threeToSixMonths' | 'justBrowsing';

export interface Inquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  fundingMethod?: FundingMethod;
  timeline?: PurchaseTimeline;
  hasAgent?: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface InquiryInput {
  listingId: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  message: string;
  fundingMethod?: FundingMethod;
  timeline?: PurchaseTimeline;
  hasAgent?: boolean;
}
