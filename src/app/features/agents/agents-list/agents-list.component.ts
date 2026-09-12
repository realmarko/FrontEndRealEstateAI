import { Component, computed, inject, signal } from '@angular/core';
import { AgentService } from '../../../core/services/agent.service';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { AgentCardComponent } from '../components/agent-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

@Component({
  selector: 'app-agents-list',
  standalone: true,
  imports: [AgentCardComponent, TranslatePipe],
  templateUrl: './agents-list.component.html',
  styleUrl: './agents-list.component.css'
})
export class AgentsListComponent {
  private readonly agentService = inject(AgentService);
  private readonly brokerageService = inject(BrokerageService);

  readonly search = signal('');
  readonly specialty = signal('');
  readonly company = signal('');
  readonly minRating = signal(0);
  readonly page = signal(1);
  readonly brokerages = signal<string[]>([]);
  readonly agents = this.agentService.agents;
  readonly totalCount = this.agentService.totalCount;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    this.brokerageService.search().subscribe((names) => this.brokerages.set(names));
    // Re-fetch on every visit to this page (AgentService's cache is a shared singleton that
    // can go stale after actions elsewhere, e.g. submitting or deleting a review).
    this.refreshNow();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.debounceRefresh();
  }

  onSpecialtyChange(term: string): void {
    this.specialty.set(term);
    this.debounceRefresh();
  }

  onCompanyChange(term: string): void {
    this.company.set(term);
    this.debounceRefresh();
  }

  onMinRatingChange(value: string): void {
    this.minRating.set(Number(value) || 0);
    this.page.set(1);
    this.refreshNow();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.refreshNow();
  }

  private debounceRefresh(): void {
    this.page.set(1);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.refreshNow(), SEARCH_DEBOUNCE_MS);
  }

  private refreshNow(): void {
    this.agentService.refresh(
      {
        name: this.search().trim() || undefined,
        specialty: this.specialty().trim() || undefined,
        company: this.company().trim() || undefined,
        minRating: this.minRating() || undefined
      },
      this.page(),
      PAGE_SIZE
    );
  }
}
