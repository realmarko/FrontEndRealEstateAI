import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { ListingService } from '../../../core/services/listing.service';
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

  readonly listings = computed(() => {
    const type = this.typeFilter();
    const term = this.search().trim().toLowerCase();

    return this.listingService.listings().filter((listing) => {
      const matchesType = type === 'all' || listing.type === type;
      const matchesTerm =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  });

  constructor(private readonly listingService: ListingService) {}

  setTypeFilter(type: ListingType | 'all'): void {
    this.typeFilter.set(type);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }
}
