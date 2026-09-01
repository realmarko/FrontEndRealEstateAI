import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from '../../core/services/message.service';
import { Conversation } from '../../core/models/message.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent {
  private readonly messageService = inject(MessageService);

  readonly selectedId = signal<string | null>(null);
  readonly conversations = this.messageService.conversations;

  select(conversation: Conversation): void {
    this.selectedId.set(conversation.id);
  }

  selected(): Conversation | undefined {
    return this.conversations().find((c) => c.id === this.selectedId());
  }
}
