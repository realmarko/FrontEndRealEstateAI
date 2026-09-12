import { Component, computed, signal } from '@angular/core';
import { AgentService } from '../../../core/services/agent.service';
import { AgentCardComponent } from '../components/agent-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-agents-list',
  standalone: true,
  imports: [AgentCardComponent, TranslatePipe],
  templateUrl: './agents-list.component.html',
  styleUrl: './agents-list.component.css'
})
export class AgentsListComponent {
  readonly search = signal('');

  readonly agents = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.agentService
      .agents()
      .filter((agent) => !term || agent.name.toLowerCase().includes(term));
  });

  constructor(private readonly agentService: AgentService) {}

  onSearchChange(term: string): void {
    this.search.set(term);
  }
}
