import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingCardComponent } from '../listings/components/listing-card.component';
import { FavoritesService } from '../../core/services/favorites.service';
import { ListingService } from '../../core/services/listing.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [RouterLink, ListingCardComponent, TranslatePipe],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css'
})
export class FavoritesComponent {
  readonly favoriteListings = computed(() => {
    const ids = new Set(this.favorites.favoriteIds());
    return this.listingService.listings().filter((listing) => ids.has(listing.id));
  });

  constructor(
    protected readonly favorites: FavoritesService,
    private readonly listingService: ListingService
  ) {}

  toggleFavorite(listingId: string): void {
    this.favorites.toggle(listingId);
  }
}
