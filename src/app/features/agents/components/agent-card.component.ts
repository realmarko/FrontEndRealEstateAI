import { Component, Input } from '@angular/core';
import { Agent } from '../../../core/models/agent.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-agent-card',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './agent-card.component.html',
  styleUrl: './agent-card.component.css'
})
export class AgentCardComponent {
  @Input({ required: true }) agent!: Agent;

  get initials(): string {
    return this.agent.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
