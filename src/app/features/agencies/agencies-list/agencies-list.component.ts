import { Component, computed, inject, signal } from '@angular/core';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { AgencyCardComponent } from '../components/agency-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

@Component({
  selector: 'app-agencies-list',
  standalone: true,
  imports: [AgencyCardComponent, TranslatePipe],
  templateUrl: './agencies-list.component.html',
  styleUrl: './agencies-list.component.css'
})
export class AgenciesListComponent {
  private readonly brokerageService = inject(BrokerageService);

  readonly search = signal('');
  readonly state = signal('');
  readonly city = signal('');
  readonly page = signal(1);
  readonly agencies = this.brokerageService.agencies;
  readonly totalCount = this.brokerageService.totalCount;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Re-fetch on every visit (BrokerageService's directory signal is a shared singleton that
    // can go stale after actions elsewhere, e.g. an agent editing their agency profile).
    this.refreshNow();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.debounceRefresh();
  }

  onStateChange(term: string): void {
    this.state.set(term);
    this.debounceRefresh();
  }

  onCityChange(term: string): void {
    this.city.set(term);
    this.debounceRefresh();
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
    this.brokerageService.refreshDirectory(
      {
        name: this.search().trim() || undefined,
        state: this.state().trim() || undefined,
        city: this.city().trim() || undefined
      },
      this.page(),
      PAGE_SIZE
    );
  }
}
