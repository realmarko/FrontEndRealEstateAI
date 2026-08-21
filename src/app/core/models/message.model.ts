export interface Message {
  id: string;
  listingId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  messages: Message[];
}
