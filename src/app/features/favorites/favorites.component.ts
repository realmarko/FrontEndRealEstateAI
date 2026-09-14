import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingGridComponent } from '../../shared/components/listing-grid/listing-grid.component';
import { FavoritesService } from '../../core/services/favorites.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [RouterLink, ListingGridComponent, TranslatePipe],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css'
})
export class FavoritesComponent {
  constructor(protected readonly favorites: FavoritesService) {}
}
