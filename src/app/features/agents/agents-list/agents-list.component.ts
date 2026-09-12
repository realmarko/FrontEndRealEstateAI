import { Component, inject, signal } from '@angular/core';
import { AgentService } from '../../../core/services/agent.service';
import { AgentCardComponent } from '../components/agent-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-agents-list',
  standalone: true,
  imports: [AgentCardComponent, TranslatePipe],
  templateUrl: './agents-list.component.html',
  styleUrl: './agents-list.component.css'
})
export class AgentsListComponent {
  private readonly agentService = inject(AgentService);

  readonly search = signal('');
  readonly agents = this.agentService.agents;

  private searchTimeout?: ReturnType<typeof setTimeout>;

  onSearchChange(term: string): void {
    this.search.set(term);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(
      () => this.agentService.refresh(term.trim() || undefined),
      SEARCH_DEBOUNCE_MS
    );
  }
}
