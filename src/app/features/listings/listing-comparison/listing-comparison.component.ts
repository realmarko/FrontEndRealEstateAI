import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ComparisonService } from '../../../core/services/comparison.service';
import { ListingService } from '../../../core/services/listing.service';
import { DEFAULT_LISTING_IMAGE, Listing } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';
import {
  AppreciationPotentialAtPoint,
  GeomarketingService,
  PopulationDensity,
  SocioeconomicLevel
} from '../../../core/services/geomarketing.service';

export interface ListingLocationData {
  population: PopulationDensity | null;
  appreciation: AppreciationPotentialAtPoint | null;
}

// Same labels/levels as map-view.component.ts's SOCIOECONOMIC_LEVEL_LABEL_KEYS — kept as its own
// copy here rather than extracted to a shared location for a second use (project convention:
// extract once a pattern repeats across 3+ places, not 2).
const SOCIOECONOMIC_LEVEL_LABEL_KEYS: Record<SocioeconomicLevel, string> = {
  Bajo: 'map.socioeconomicBajo',
  MedioBajo: 'map.socioeconomicMedioBajo',
  Medio: 'map.socioeconomicMedio',
  MedioAlto: 'map.socioeconomicMedioAlto',
  Alto: 'map.socioeconomicAlto'
};

@Component({
  selector: 'app-listing-comparison',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DecimalPipe, TranslatePipe],
  templateUrl: './listing-comparison.component.html',
  styleUrl: './listing-comparison.component.css'
})
export class ListingComparisonComponent {
  protected readonly comparison = inject(ComparisonService);
  private readonly listingService = inject(ListingService);
  private readonly geomarketing = inject(GeomarketingService);
  protected readonly translation = inject(TranslationService);

  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;
  protected readonly socioeconomicLevelLabelKeys = SOCIOECONOMIC_LEVEL_LABEL_KEYS;
  readonly listings = signal<Listing[]>([]);
  readonly loading = signal(true);
  readonly loadedIds = computed(() => this.listings().map((l) => l.id));

  // Keyed by listing id — a listing whose location falls outside today's imported AGEB coverage
  // (anywhere but Puebla/Tlaxcala) simply has no entry, rendered as "—" per row, same spirit as
  // every other optional field in this table.
  readonly locationData = signal<Map<string, ListingLocationData>>(new Map());

  // Mobile-only: which card the swipeable carousel (see the component's HTML) is currently
  // centered on, so the dot indicator below it can highlight the right one.
  @ViewChild('carouselTrack') private carouselTrack?: ElementRef<HTMLElement>;
  readonly activeCardIndex = signal(0);

  constructor() {
    inject(SeoService).set({
      title: 'Comparar propiedades',
      description: 'Compara propiedades lado a lado en Espacial.com.mx.',
      path: this.translation.path('compare'),
      hreflang: this.translation.hreflangPaths('compare')
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
        this.fetchLocationData(listings);
      },
      error: () => {
        this.listings.set([]);
        this.loading.set(false);
      }
    });
  }

  // Unlike fetchListings above, a 404 here is the expected/common case (today's AGEB coverage is
  // only Puebla/Tlaxcala) rather than a real error — each listing's pair of calls is caught
  // independently so one property with no coverage never blanks out the others' data.
  private fetchLocationData(listings: Listing[]): void {
    const withLocation = listings.filter((l) => l.lat != null && l.lng != null);
    if (withLocation.length === 0) return;

    forkJoin(
      withLocation.map((listing) =>
        // Each call already catches its own error into null, so this inner forkJoin itself can
        // never error — no outer catchError needed on top of it.
        forkJoin({
          population: this.geomarketing.populationDensity(listing.lat!, listing.lng!).pipe(catchError(() => of(null))),
          appreciation: this.geomarketing.appreciationPotentialAtPoint(listing.lat!, listing.lng!).pipe(catchError(() => of(null)))
        })
      )
    ).subscribe((results) => {
      const map = new Map<string, ListingLocationData>();
      withLocation.forEach((listing, i) => map.set(listing.id, results[i]));
      this.locationData.set(map);
    });
  }

  // A touch-driven swipe fires this dozens of times a second — coalesce to one measurement per
  // animation frame instead of running the distance calc (and the change detection it triggers)
  // on every single scroll event.
  private scrollUpdateQueued = false;

  onCarouselScroll(): void {
    if (this.scrollUpdateQueued) return;
    this.scrollUpdateQueued = true;
    requestAnimationFrame(() => {
      this.scrollUpdateQueued = false;
      this.updateActiveCardIndex();
    });
  }

  private updateActiveCardIndex(): void {
    const track = this.carouselTrack?.nativeElement;
    if (!track) return;

    const cards = Array.from(track.children) as HTMLElement[];
    const viewportCenter = track.scrollLeft + track.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;
    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    });
    this.activeCardIndex.set(closestIndex);
  }

  scrollToCard(index: number): void {
    const track = this.carouselTrack?.nativeElement;
    const card = track?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  remove(listingId: string): void {
    this.comparison.remove(listingId);
    this.listings.update((list) => list.filter((l) => l.id !== listingId));
    // Removing a card shifts every later index down — without this, activeCardIndex can point
    // past the end of the shorter list (or at the wrong card), leaving the mobile carousel's dot
    // indicator stuck on no dot or the wrong one until the user scrolls again.
    this.activeCardIndex.update((i) => Math.min(i, Math.max(this.listings().length - 1, 0)));
  }

  pricePerSqm(listing: Listing): number {
    return listing.areaSqm > 0 ? listing.price / listing.areaSqm : 0;
  }
}
