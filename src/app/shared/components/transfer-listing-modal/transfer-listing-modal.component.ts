import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { AgentService } from '../../../core/services/agent.service';
import { Agent } from '../../../core/models/agent.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

const SEARCH_DEBOUNCE_MS = 300;

// Admin-only picker for ListingDetailComponent's "transfer to another agent" action — a text
// search (debounced, same pattern as AgentsListComponent) narrowed to agents with a results
// list to pick from, since there's no listing-wide agent id the admin would already know.
@Component({
  selector: 'app-transfer-listing-modal',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './transfer-listing-modal.component.html',
  styleUrl: './transfer-listing-modal.component.css'
})
export class TransferListingModalComponent {
  private readonly agentService = inject(AgentService);

  @Input() sending = false;

  @Output() closed = new EventEmitter<void>();
  @Output() transfer = new EventEmitter<Agent>();

  readonly query = signal('');
  readonly results = signal<Agent[]>([]);
  readonly loading = signal(false);
  readonly selectedAgent = signal<Agent | undefined>(undefined);

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private searchSequence = 0;

  constructor() {
    this.runSearch();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.selectedAgent.set(undefined);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.runSearch(), SEARCH_DEBOUNCE_MS);
  }

  private runSearch(): void {
    const sequence = ++this.searchSequence;
    this.loading.set(true);
    this.agentService.searchForPicker(this.query().trim()).subscribe({
      next: (agents) => {
        if (sequence !== this.searchSequence) return;
        this.results.set(agents);
        this.loading.set(false);
      },
      error: () => {
        if (sequence !== this.searchSequence) return;
        this.results.set([]);
        this.loading.set(false);
      }
    });
  }

  selectAgent(agent: Agent): void {
    this.selectedAgent.set(agent);
  }

  close(): void {
    if (this.sending) return;
    this.closed.emit();
  }

  confirm(): void {
    const agent = this.selectedAgent();
    if (!agent || this.sending) return;
    this.transfer.emit(agent);
  }
}
