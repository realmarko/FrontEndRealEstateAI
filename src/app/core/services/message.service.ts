import { Injectable, signal } from '@angular/core';
import { Conversation, Message } from '../models/message.model';

const CONVERSATIONS_KEY = 'reapp_conversations';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly conversationsSignal = signal<Conversation[]>(this.readConversations());

  readonly conversations = this.conversationsSignal.asReadonly();

  getByListingId(listingId: string): Conversation | undefined {
    return this.conversationsSignal().find((c) => c.listingId === listingId);
  }

  sendMessage(
    listingId: string,
    listingTitle: string,
    senderId: string,
    senderName: string,
    body: string
  ): void {
    const message: Message = {
      id: crypto.randomUUID(),
      listingId,
      senderId,
      senderName,
      body,
      createdAt: new Date().toISOString()
    };

    const conversations = this.conversationsSignal();
    const existing = conversations.find((c) => c.listingId === listingId);
    let next: Conversation[];

    if (existing) {
      next = conversations.map((c) =>
        c.listingId === listingId ? { ...c, messages: [...c.messages, message] } : c
      );
    } else {
      next = [
        ...conversations,
        { id: crypto.randomUUID(), listingId, listingTitle, messages: [message] }
      ];
    }

    this.conversationsSignal.set(next);
    this.writeConversations(next);
  }

  private readConversations(): Conversation[] {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  }

  private writeConversations(conversations: Conversation[]): void {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }
}
