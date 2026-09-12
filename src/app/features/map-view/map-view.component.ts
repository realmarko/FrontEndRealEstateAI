import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ListingService } from '../../core/services/listing.service';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ListingCardComponent } from '../listings/components/listing-card.component';
import { Listing, ListingType, PropertyType } from '../../core/models/listing.model';
import { digitsFromInput, formatCurrencyDisplay } from '../../shared/utils/currency-input';

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 19.0414, lng: -98.2063 }; // Puebla, MX
const DEFAULT_ZOOM = 18;
const GOOGLE_LOAD_POLL_MS = 100;
const MY_LISTING_ICON = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ListingCardComponent],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.css'
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;

  hasError = false;
  addMode = false;
  selectedLat: number | null = null;
  selectedLng: number | null = null;

  readonly search = signal('');
  readonly typeFilter = signal<ListingType | 'all'>('all');
  readonly propertyTypeFilter = signal<PropertyType | 'all'>('all');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minBeds = signal<number | 'any'>('any');
  readonly minBaths = signal<number | 'any'>('any');
  readonly showMoreFilters = signal(false);

  readonly filteredListings = computed(() => {
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const propertyType = this.propertyTypeFilter();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const minBd = this.minBeds();
    const minBa = this.minBaths();

    return this.listingService.listings().filter((listing) => {
      const matchesTerm =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term);
      const matchesType = type === 'all' || listing.type === type;
      const matchesPropertyType = propertyType === 'all' || listing.propertyType === propertyType;
      const matchesMinPrice = minP === null || listing.price >= minP;
      const matchesMaxPrice = maxP === null || listing.price <= maxP;
      const matchesBeds = minBd === 'any' || listing.bedrooms >= minBd;
      const matchesBaths = minBa === 'any' || listing.bathrooms >= minBa;
      return (
        matchesTerm && matchesType && matchesPropertyType && matchesMinPrice && matchesMaxPrice && matchesBeds && matchesBaths
      );
    });
  });

  private readonly mapBounds = signal<google.maps.LatLngBounds | null>(null);

  // Only listings whose marker is currently visible in the map's viewport — mirrors the
  // filtered set further by pan/zoom, the same way Zillow's results list follows the map.
  readonly visibleListings = computed(() => {
    const bounds = this.mapBounds();

    return this.filteredListings().filter((listing) => {
      if (listing.lat == null || listing.lng == null) return false;
      if (!bounds) return true; // map hasn't reported its viewport yet
      return bounds.contains({ lat: listing.lat, lng: listing.lng });
    });
  });

  private map?: google.maps.Map;
  private marker?: google.maps.Marker;
  private readonly listingMarkers = new Map<string, google.maps.Marker>();
  private infoWindow?: google.maps.InfoWindow;
  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly listingService: ListingService,
    private readonly translation: TranslationService,
    protected readonly auth: AuthService,
    protected readonly favorites: FavoritesService
  ) {
    // Re-render markers whenever the filtered listings or the logged-in user change (so "my
    // listings" stay correctly highlighted, and the map mirrors the list), without a full reload.
    effect(() => {
      this.filteredListings();
      this.auth.currentUser();
      if (this.map) {
        this.renderListingMarkers();
      }
    });
  }

  ngAfterViewInit(): void {
    this.waitForGoogleMaps();
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
  }

  private waitForGoogleMaps(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.initMap();
      return;
    }

    this.pollHandle = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps) {
        clearInterval(this.pollHandle);
        this.initMap();
      }
    }, GOOGLE_LOAD_POLL_MS);

    setTimeout(() => {
      if (this.pollHandle) {
        clearInterval(this.pollHandle);
        if (typeof google === 'undefined' || !google.maps) {
          this.hasError = true;
        }
      }
    }, 10000);
  }

  private initMap(): void {
    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false
    });
    this.infoWindow = new google.maps.InfoWindow();

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!this.addMode || !event.latLng) return;
      this.zone.run(() => this.placeMarker(event.latLng!));
    });

    // Fires after every pan/zoom settles (and once on initial load) — keeps the results
    // list scoped to whatever's actually visible on the map right now.
    this.map.addListener('idle', () => {
      this.zone.run(() => this.mapBounds.set(this.map!.getBounds() ?? null));
    });

    this.renderListingMarkers();
    this.centerOnCurrentLocation();
  }

  private renderListingMarkers(): void {
    this.listingMarkers.forEach((marker) => marker.setMap(null));
    this.listingMarkers.clear();

    const listings = this.filteredListings().filter((listing) => listing.lat != null && listing.lng != null);
    const currentUserId = this.auth.currentUser()?.id;

    for (const listing of listings) {
      const marker = new google.maps.Marker({
        position: { lat: listing.lat!, lng: listing.lng! },
        map: this.map,
        title: listing.title,
        icon: listing.ownerId === currentUserId ? MY_LISTING_ICON : undefined
      });

      marker.addListener('click', () => {
        this.zone.run(() => this.openListingInfo(listing, marker));
      });

      this.listingMarkers.set(listing.id, marker);
    }
  }

  private openListingInfo(listing: Listing, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;

    const price = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: listing.currency
    }).format(listing.price);

    const container = document.createElement('div');

    const titleEl = document.createElement('strong');
    titleEl.textContent = listing.title;

    const priceEl = document.createElement('div');
    priceEl.textContent = price;

    const link = document.createElement('a');
    link.href = `/listings/${listing.id}`;
    link.textContent = this.translation.t('map.viewDetails');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      this.zone.run(() => this.router.navigate(['/listings', listing.id]));
    });

    container.append(titleEl, document.createElement('br'), priceEl, document.createElement('br'), link);

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  private centerOnCurrentLocation(): void {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.map?.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        this.map?.setZoom(DEFAULT_ZOOM);
      },
      () => {
        // Location denied or unavailable: keep the default center.
      },
      { timeout: 8000 }
    );
  }

  private placeMarker(latLng: google.maps.LatLng): void {
    this.selectedLat = latLng.lat();
    this.selectedLng = latLng.lng();

    if (this.marker) {
      this.marker.setPosition(latLng);
    } else {
      this.marker = new google.maps.Marker({ position: latLng, map: this.map, draggable: true });
      this.marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        this.zone.run(() => {
          this.selectedLat = event.latLng!.lat();
          this.selectedLng = event.latLng!.lng();
        });
      });
    }
  }

  toggleAddMode(): void {
    this.addMode = !this.addMode;
  }

  confirmLocation(): void {
    if (this.selectedLat === null || this.selectedLng === null) return;

    this.router.navigate(['/listings/new'], {
      queryParams: { lat: this.selectedLat, lng: this.selectedLng }
    });
  }

  onSearchChange(term: string): void {
    this.search.set(term);
  }

  setTypeFilter(type: ListingType | 'all'): void {
    this.typeFilter.set(type);
  }

  setPropertyTypeFilter(propertyType: PropertyType | 'all'): void {
    this.propertyTypeFilter.set(propertyType);
  }

  setMinPrice(target: HTMLInputElement): void {
    const digits = digitsFromInput(target.value);
    target.value = formatCurrencyDisplay(digits);
    this.minPrice.set(digits === '' ? null : Number(digits));
  }

  setMaxPrice(target: HTMLInputElement): void {
    const digits = digitsFromInput(target.value);
    target.value = formatCurrencyDisplay(digits);
    this.maxPrice.set(digits === '' ? null : Number(digits));
  }

  setMinBeds(value: string): void {
    this.minBeds.set(value === 'any' ? 'any' : Number(value));
  }

  setMinBaths(value: string): void {
    this.minBaths.set(value === 'any' ? 'any' : Number(value));
  }

  toggleMoreFilters(): void {
    this.showMoreFilters.update((v) => !v);
  }

  toggleFavorite(listingId: string): void {
    this.favorites.toggle(listingId);
  }

  onCardHover(listingId: string): void {
    this.listingMarkers.get(listingId)?.setAnimation(google.maps.Animation.BOUNCE);
  }

  onCardLeave(listingId: string): void {
    this.listingMarkers.get(listingId)?.setAnimation(null);
  }
}
