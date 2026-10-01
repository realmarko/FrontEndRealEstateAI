import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { ListingService } from '../../../core/services/listing.service';
import { Agency } from '../../../core/models/agency.model';
import { Listing, ListingType } from '../../../core/models/listing.model';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-agency-detail',
  standalone: true,
  imports: [RouterLink, ListingGridComponent, TranslatePipe],
  templateUrl: './agency-detail.component.html',
  styleUrl: './agency-detail.component.css'
})
export class AgencyDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly brokerageService = inject(BrokerageService);
  private readonly listingService = inject(ListingService);

  readonly agency = signal<Agency | null>(null);
  readonly notFound = signal(false);
  private readonly agencyListings = signal<Listing[]>([]);

  // Same filter shape as /listings (ListingListComponent) minus the company filter, which would
  // be redundant here — every listing on this page already belongs to this one agency.
  readonly typeFilter = signal<ListingType | 'all'>('all');
  readonly search = signal('');

  readonly location = computed(() => {
    const a = this.agency();
    return a ? [a.city, a.state].filter(Boolean).join(', ') : '';
  });

  readonly listings = computed(() => {
    const type = this.typeFilter();
    const term = this.search().trim().toLowerCase();

    return this.agencyListings().filter((listing) => {
      const matchesType = type === 'all' || listing.type === type;
      const matchesTerm =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.brokerageService.fetchById(id).subscribe({
      next: (agency) => this.agency.set(agency),
      error: () => this.notFound.set(true)
    });
    this.listingService.fetchByAgency(id).subscribe((listings) => this.agencyListings.set(listings));
  }

  setTypeFilter(type: ListingType | 'all'): void {
    this.typeFilter.set(type);
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }
}
