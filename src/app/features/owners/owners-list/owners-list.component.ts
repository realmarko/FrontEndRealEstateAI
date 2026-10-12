import { Component, computed, inject, signal } from '@angular/core';
import { OwnerService } from '../../../core/services/owner.service';
import { OwnerCardComponent } from '../components/owner-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

@Component({
  selector: 'app-owners-list',
  standalone: true,
  imports: [OwnerCardComponent, TranslatePipe],
  templateUrl: './owners-list.component.html',
  styleUrl: './owners-list.component.css'
})
export class OwnersListComponent {
  private readonly ownerService = inject(OwnerService);

  readonly search = signal('');
  readonly page = signal(1);
  readonly owners = this.ownerService.owners;
  readonly totalCount = this.ownerService.totalCount;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  private searchTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Re-fetch on every visit to this page — OwnerService's cache is a shared singleton that
    // can go stale after actions elsewhere, same reasoning as AgentsListComponent.
    this.refreshNow();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.page.set(1);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.refreshNow(), SEARCH_DEBOUNCE_MS);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.refreshNow();
  }

  private refreshNow(): void {
    this.ownerService.refresh({ name: this.search().trim() || undefined }, this.page(), PAGE_SIZE);
  }
}
