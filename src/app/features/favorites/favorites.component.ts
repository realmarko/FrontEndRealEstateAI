import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ListingGridComponent } from '../../shared/components/listing-grid/listing-grid.component';
import { FavoritesService } from '../../core/services/favorites.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { StatePanelComponent } from '../../shared/components/state-panel/state-panel.component';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [RouterLink, ListingGridComponent, TranslatePipe, SkeletonLoaderComponent, StatePanelComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css'
})
export class FavoritesComponent {
  constructor(protected readonly favorites: FavoritesService, seo: SeoService) {
    seo.set({ title: 'Mis favoritos', description: 'Tus propiedades favoritas en Espacial.com.mx.', path: '/favorites' });
  }

  retry(): void {
    this.favorites.refresh();
  }
}
