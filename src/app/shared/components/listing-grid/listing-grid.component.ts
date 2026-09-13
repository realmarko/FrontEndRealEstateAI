import { Component, Input, inject } from '@angular/core';
import { Listing } from '../../../core/models/listing.model';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ListingCardComponent } from '../../../features/listings/components/listing-card.component';

// Shared by every page that renders a grid of listing cards (listing list, favorites, an
// agent's profile) so favorite-toggle wiring and the grid layout live in one place.
@Component({
  selector: 'app-listing-grid',
  standalone: true,
  imports: [ListingCardComponent],
  templateUrl: './listing-grid.component.html',
  styleUrl: './listing-grid.component.css'
})
export class ListingGridComponent {
  @Input({ required: true }) listings: Listing[] = [];

  private readonly favorites = inject(FavoritesService);

  isFavorite(listingId: string): boolean {
    return this.favorites.isFavorite(listingId);
  }

  toggleFavorite(listingId: string): void {
    this.favorites.toggle(listingId);
  }
}
