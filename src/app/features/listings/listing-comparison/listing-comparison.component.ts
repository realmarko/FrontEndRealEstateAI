import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ComparisonService } from '../../../core/services/comparison.service';
import { ListingService } from '../../../core/services/listing.service';
import { DEFAULT_LISTING_IMAGE, Listing } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-listing-comparison',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, TranslatePipe],
  templateUrl: './listing-comparison.component.html',
  styleUrl: './listing-comparison.component.css'
})
export class ListingComparisonComponent {
  protected readonly comparison = inject(ComparisonService);
  private readonly listingService = inject(ListingService);

  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;
  readonly listings = signal<Listing[]>([]);
  readonly loading = signal(true);
  readonly loadedIds = computed(() => this.listings().map((l) => l.id));

  constructor() {
    inject(SeoService).set({
      title: 'Comparar propiedades',
      description: 'Compara propiedades lado a lado en Espacial.com.mx.',
      path: '/comparar'
    });
    this.fetchListings();
  }

  // ComparisonService only stores ids — this component is the one place that actually needs
  // the full Listing objects, so the fetch lives here rather than in the service (the compare
  // bar and the card checkboxes never need more than the id).
  private fetchListings(): void {
    const ids = this.comparison.ids();
    if (ids.length === 0) {
      this.listings.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    forkJoin(ids.map((id) => this.listingService.fetchById(id))).subscribe({
      // A listing removed/deleted since it was added to the comparison would fail the whole
      // forkJoin — fall back to an empty result rather than leaving the page stuck loading;
      // the removed id still sits in ComparisonService, so remove() below is still usable to
      // drop it (findability over cleverness: no need to guess which one 404'd).
      next: (listings) => {
        this.listings.set(listings);
        this.loading.set(false);
      },
      error: () => {
        this.listings.set([]);
        this.loading.set(false);
      }
    });
  }

  remove(listingId: string): void {
    this.comparison.remove(listingId);
    this.listings.update((list) => list.filter((l) => l.id !== listingId));
  }

  pricePerSqm(listing: Listing): number {
    return listing.areaSqm > 0 ? listing.price / listing.areaSqm : 0;
  }
}
