import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { ListingService } from '../../../core/services/listing.service';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { SavedSearchService } from '../../../core/services/saved-search.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { ListingType } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-listing-list',
  standalone: true,
  imports: [RouterLink, ListingGridComponent, TranslatePipe],
  templateUrl: './listing-list.component.html',
  styleUrl: './listing-list.component.css'
})
export class ListingListComponent {
  readonly typeFilter = signal<ListingType | 'all'>('all');
  readonly search = signal('');
  readonly companyFilter = signal('');
  readonly brokerages = signal<string[]>([]);
  readonly showSaveSearchForm = signal(false);
  readonly saveSearchName = signal('');

  readonly listings = computed(() => {
    const type = this.typeFilter();
    const term = this.search().trim().toLowerCase();
    const company = this.companyFilter().trim().toLowerCase();

    return this.listingService.listings().filter((listing) => {
      const matchesType = type === 'all' || listing.type === type;
      const matchesTerm =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term);
      const matchesCompany = !company || (listing.ownerCompany?.toLowerCase().includes(company) ?? false);
      return matchesType && matchesTerm && matchesCompany;
    });
  });

  constructor(
    private readonly listingService: ListingService,
    private readonly brokerageService: BrokerageService,
    private readonly savedSearchService: SavedSearchService,
    private readonly notification: NotificationService,
    protected readonly auth: AuthService
  ) {
    this.brokerageService.search().subscribe((names) => this.brokerages.set(names));
  }

  setTypeFilter(type: ListingType | 'all'): void {
    this.typeFilter.set(type);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }

  setCompanyFilter(term: string): void {
    this.companyFilter.set(term);
  }

  toggleSaveSearchForm(): void {
    this.showSaveSearchForm.update((v) => !v);
  }

  setSaveSearchName(name: string): void {
    this.saveSearchName.set(name);
  }

  saveCurrentSearch(): void {
    const name = this.saveSearchName().trim();
    if (!name) return;

    const type = this.typeFilter();

    this.savedSearchService
      .create({
        name,
        listingType: type === 'all' ? undefined : type
      })
      .subscribe({
        next: () => {
          this.notification.success('savedSearches.saved');
          this.saveSearchName.set('');
          this.showSaveSearchForm.set(false);
        },
        error: () => this.notification.error('savedSearches.saveError')
      });
  }
}
