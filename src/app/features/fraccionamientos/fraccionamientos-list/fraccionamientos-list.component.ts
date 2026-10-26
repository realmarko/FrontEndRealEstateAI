import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FraccionamientoService } from '../../../core/services/fraccionamiento.service';
import { FraccionamientoLocation, FraccionamientoPublicListItem } from '../../../core/models/fraccionamiento.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { SeoService } from '../../../core/services/seo.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-fraccionamientos-list',
  standalone: true,
  imports: [RouterLink, TranslatePipe, SkeletonLoaderComponent, StatePanelComponent],
  templateUrl: './fraccionamientos-list.component.html',
  styleUrl: './fraccionamientos-list.component.css'
})
export class FraccionamientosListComponent implements OnInit {
  readonly items = signal<FraccionamientoPublicListItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly page = signal(1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));

  readonly locations = signal<FraccionamientoLocation[]>([]);
  readonly stateFilter = signal<string>('');
  readonly cityFilter = signal<string>('');
  readonly states = computed(() => [...new Set(this.locations().map((l) => l.state))].sort());
  // Narrowed to the selected state once one is picked — a city only makes sense within the
  // state the visitor is currently filtering by, and keeps the dropdown short.
  readonly cities = computed(() => {
    const state = this.stateFilter();
    const pool = state ? this.locations().filter((l) => l.state === state) : this.locations();
    return [...new Set(pool.map((l) => l.city))].sort();
  });

  // Same guard as admin-fraccionamientos: a slower response from a page change fired earlier
  // must not overwrite items()/totalCount() with data for a page the visitor already left.
  private loadSequence = 0;

  constructor(
    private readonly fraccionamientoService: FraccionamientoService,
    private readonly router: Router,
    seo: SeoService
  ) {
    seo.set({
      title: 'Fraccionamientos',
      description: 'Explora fraccionamientos y desarrollos residenciales en México.',
      path: '/fraccionamientos'
    });
  }

  ngOnInit(): void {
    this.load();
    // Best-effort: a failed fetch just leaves the filters empty (no state/city to pick), it
    // shouldn't block or error the page itself.
    this.fraccionamientoService.getPublishedLocations().subscribe({
      next: (locations) => this.locations.set(locations),
      error: () => {}
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  setStateFilter(state: string): void {
    if (state === this.stateFilter()) return;
    this.stateFilter.set(state);
    // The previously-picked city may not exist in the newly-selected state (or none was picked
    // yet) — clearing it avoids silently keeping a now-irrelevant city filter applied.
    this.cityFilter.set('');
    this.page.set(1);
    this.load();
  }

  setCityFilter(city: string): void {
    if (city === this.cityFilter()) return;
    this.cityFilter.set(city);
    this.page.set(1);
    this.load();
  }

  retry(): void {
    this.load();
  }

  // Same shape as ListingDetailComponent.viewOnMap — centers /map on this development's own
  // marker (already plotted there via FraccionamientoService.listPublished), no listingId needed.
  viewOnMap(item: FraccionamientoPublicListItem): void {
    this.router.navigate(['/map'], { queryParams: { lat: item.latitude, lng: item.longitude } });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const sequence = ++this.loadSequence;

    this.fraccionamientoService
      .listPublished({
        state: this.stateFilter() || undefined,
        city: this.cityFilter() || undefined,
        page: this.page(),
        pageSize: PAGE_SIZE
      })
      .subscribe({
        next: (result) => {
          if (sequence !== this.loadSequence) return;
          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          if (sequence !== this.loadSequence) return;
          this.loading.set(false);
          this.loadError.set(true);
        }
      });
  }
}
