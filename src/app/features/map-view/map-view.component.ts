import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { MarkerClusterer, Renderer } from '@googlemaps/markerclusterer';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ListingService } from '../../core/services/listing.service';
import { BrokerageService } from '../../core/services/brokerage.service';
import { SavedSearchService } from '../../core/services/saved-search.service';
import { NotificationService } from '../../core/services/notification.service';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ListingCardComponent } from '../listings/components/listing-card.component';
import { DEFAULT_LISTING_IMAGE, Listing, ListingType, PROPERTY_TYPE_OPTIONS, PropertyType } from '../../core/models/listing.model';
import { applyCurrencyMask } from '../../shared/utils/currency-input';
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_INTEREST_RATE_PERCENT,
  DEFAULT_TERM_YEARS,
  calculateMonthlyPayment
} from '../../shared/utils/mortgage';

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 19.0414, lng: -98.2063 }; // Puebla, MX
const DEFAULT_ZOOM = 16;
const GOOGLE_LOAD_POLL_MS = 100;
const MY_LISTING_ICON = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
const MY_LOCATION_ICON = 'https://maps.google.com/mapfiles/kml/shapes/man.png';

// The clustering algorithm's default maxZoom (16) stops clustering well before this app's own
// default zoom (16-18, street level) — raised so nearby markers still group up there too.
const CLUSTER_ALGORITHM_OPTIONS = { maxZoom: 20 };

export type PoiCategoryKey = 'schools' | 'pharmacies' | 'malls' | 'parks';

interface PoiCategoryConfig {
  key: PoiCategoryKey;
  labelKey: string;
  // Google Places "type" filter — see https://developers.google.com/maps/documentation/places/web-service/supported_types
  placeType: string;
  icon: string;
  clusterColor: string;
}

// One entry per checklist item on the map page. Each category gets its own marker color and
// cluster color so overlapping categories (e.g. schools + parks) stay visually distinguishable.
const POI_CATEGORIES: PoiCategoryConfig[] = [
  {
    key: 'schools',
    labelKey: 'map.poiSchools',
    placeType: 'school',
    icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
    clusterColor: '#15803d'
  },
  {
    key: 'pharmacies',
    labelKey: 'map.poiPharmacies',
    placeType: 'pharmacy',
    icon: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
    clusterColor: '#7c3aed'
  },
  {
    key: 'malls',
    labelKey: 'map.poiMalls',
    placeType: 'shopping_mall',
    icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
    clusterColor: '#c2410c'
  },
  {
    key: 'parks',
    labelKey: 'map.poiParks',
    placeType: 'park',
    icon: 'https://maps.google.com/mapfiles/ms/icons/pink-dot.png',
    clusterColor: '#db2777'
  }
];

// The library's default renderer colors every cluster plain blue (red once it's unusually
// large) regardless of what it's clustering — which would collide with this page's own
// blue/red "My listings"/"Other listings" legend and give a school cluster the same blue as
// "mine". A fixed color per marker type keeps a cluster's color as meaningful as the pins it's standing in for.
function createClusterRenderer(color: string): Renderer {
  return {
    render({ count, position }) {
      const svg =
        `<svg fill="${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="50" height="50">` +
        `<circle cx="120" cy="120" opacity=".6" r="70" />` +
        `<circle cx="120" cy="120" opacity=".3" r="90" />` +
        `<circle cx="120" cy="120" opacity=".2" r="110" />` +
        `<text x="50%" y="50%" style="fill:#fff" text-anchor="middle" font-size="50" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${count}</text>` +
        `</svg>`;

      return new google.maps.Marker({
        position,
        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
        title: `Cluster of ${count} markers`,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          anchor: new google.maps.Point(25, 25)
        }
      });
    }
  };
}

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
  locatingMe = false;
  selectedLat: number | null = null;
  selectedLng: number | null = null;

  readonly poiCategories = POI_CATEGORIES;
  readonly showPoiChecklist = signal(false);
  readonly checkedPoiCategories = signal<Set<PoiCategoryKey>>(new Set());
  readonly loadingPoiCategories = signal<Set<PoiCategoryKey>>(new Set());

  readonly search = signal('');
  readonly typeFilter = signal<ListingType | 'all'>('all');
  readonly propertyTypeFilter = signal<PropertyType | 'all'>('all');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minBeds = signal<number | 'any'>('any');
  readonly minBaths = signal<number | 'any'>('any');
  readonly showMoreFilters = signal(false);
  readonly propertyTypeOptions = PROPERTY_TYPE_OPTIONS;
  readonly companyFilter = signal('');
  readonly brokerages = signal<string[]>([]);
  readonly showSaveSearchForm = signal(false);
  readonly saveSearchName = signal('');

  readonly filteredListings = computed(() => {
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const propertyType = this.propertyTypeFilter();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const minBd = this.minBeds();
    const minBa = this.minBaths();
    const company = this.companyFilter().trim().toLowerCase();

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
      const matchesCompany = !company || (listing.ownerCompany?.toLowerCase().includes(company) ?? false);
      return (
        matchesTerm &&
        matchesType &&
        matchesPropertyType &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesBeds &&
        matchesBaths &&
        matchesCompany
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
  private myLocationMarker?: google.maps.Marker;
  private readonly listingMarkers = new Map<string, google.maps.Marker>();
  // One clusterer per marker type (listings + one per POI category) so a cluster icon never
  // mixes categories together, keeping each type's color meaningful when markers group up.
  private listingClusterer?: MarkerClusterer;
  private readonly poiClusterers = new Map<PoiCategoryKey, MarkerClusterer>();
  private readonly poiRequestIds = new Map<PoiCategoryKey, number>();
  private infoWindow?: google.maps.InfoWindow;
  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly listingService: ListingService,
    private readonly translation: TranslationService,
    private readonly notification: NotificationService,
    protected readonly auth: AuthService,
    protected readonly favorites: FavoritesService,
    private readonly brokerageService: BrokerageService,
    private readonly savedSearchService: SavedSearchService
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

    this.brokerageService.search().subscribe((names) => this.brokerages.set(names));
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
    this.listingClusterer = new MarkerClusterer({
      map: this.map,
      algorithmOptions: CLUSTER_ALGORITHM_OPTIONS,
      renderer: createClusterRenderer('#1e3a5f')
    });

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      // The info-window's own close button is hidden (see .gm-ui-hover-effect in styles.css),
      // so clicking anywhere else on the map is the only way left to dismiss it.
      this.infoWindow?.close();

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
    this.listingClusterer?.clearMarkers();
    this.listingMarkers.clear();

    const listings = this.filteredListings().filter((listing) => listing.lat != null && listing.lng != null);
    const currentUserId = this.auth.currentUser()?.id;
    const markers: google.maps.Marker[] = [];

    for (const listing of listings) {
      const marker = new google.maps.Marker({
        position: { lat: listing.lat!, lng: listing.lng! },
        title: listing.title,
        icon: listing.ownerId === currentUserId ? MY_LISTING_ICON : undefined
      });

      marker.addListener('click', () => {
        this.zone.run(() => this.openListingInfo(listing, marker));
      });

      this.listingMarkers.set(listing.id, marker);
      markers.push(marker);
    }

    this.listingClusterer?.addMarkers(markers);
  }

  private openListingInfo(listing: Listing, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;

    // Matches ListingCardComponent's formatting exactly (Angular's CurrencyPipe with no
    // digitsInfo override defaults to 2 decimal places) so the same listing never shows a
    // different price on its card vs. its map marker popup.
    const price = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: listing.currency
    }).format(listing.price);

    const navigate = (event: Event) => {
      event.preventDefault();
      this.zone.run(() => this.router.navigate(['/listings', listing.id]));
    };

    const container = document.createElement('div');
    container.className = 'map-info-card';

    // --- media: photo + property-type badge + for sale/rent tag + favorite toggle ---
    const media = document.createElement('div');
    media.className = 'map-info-media';
    media.style.cursor = 'pointer';
    media.addEventListener('click', navigate);

    const img = document.createElement('img');
    img.src = listing.imageUrls[0] ?? DEFAULT_LISTING_IMAGE;
    img.alt = listing.title;
    media.appendChild(img);

    if (listing.propertyType) {
      const badge = document.createElement('span');
      badge.className = 'map-info-badge';
      badge.textContent = this.translation.t(`listingForm.${listing.propertyType}`);
      media.appendChild(badge);
    }

    const tag = document.createElement('span');
    tag.className = listing.type === 'rent' ? 'map-info-tag rent' : 'map-info-tag';
    tag.textContent = this.translation.t(listing.type === 'rent' ? 'listingForm.forRent' : 'listingForm.forSale');
    media.appendChild(tag);

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'map-info-fav';
    favBtn.setAttribute('aria-label', this.translation.t('listingDetail.favorite'));
    const syncFavState = () => {
      const active = this.favorites.isFavorite(listing.id);
      // Same heart path as the listing card / listing detail page, so the icon looks
      // identical everywhere rather than relying on the browser's Unicode heart glyph.
      favBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>`;
      favBtn.setAttribute('aria-pressed', String(active));
      favBtn.classList.toggle('active', active);
    };
    syncFavState();
    favBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.zone.run(() => {
        this.favorites.toggle(listing.id);
        syncFavState();
      });
    });
    media.appendChild(favBtn);

    container.appendChild(media);

    // --- body: price, stats line, title, address ---
    const body = document.createElement('div');
    body.className = 'map-info-body';

    const priceEl = document.createElement('p');
    priceEl.className = 'map-info-price';
    priceEl.textContent = price + (listing.type === 'rent' ? this.translation.t('listing.perMonthSuffix') : '');
    body.appendChild(priceEl);

    if (listing.type === 'sale') {
      const monthlyPayment = calculateMonthlyPayment(
        listing.price,
        DEFAULT_DOWN_PAYMENT_PERCENT,
        DEFAULT_INTEREST_RATE_PERCENT,
        DEFAULT_TERM_YEARS
      );
      const formattedPayment = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: listing.currency,
        maximumFractionDigits: 0
      }).format(monthlyPayment);

      const mortgageEl = document.createElement('p');
      mortgageEl.className = 'map-info-mortgage';
      mortgageEl.innerHTML =
        `${this.translation.t('listing.estMonthlyPayment')} ${formattedPayment}${this.translation.t('listing.perMonthSuffix')} ` +
        `<span class="map-info-tooltip" title="${this.translation.t('listing.mortgageTooltip')}">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>` +
        `</span>`;
      body.appendChild(mortgageEl);
    }

    const statsEl = document.createElement('p');
    statsEl.className = 'map-info-stats';
    statsEl.innerHTML =
      `<strong>${listing.bedrooms}</strong> ${this.translation.t('listing.bedroomsAbbr')}` +
      ` <span class="sep">|</span> <strong>${listing.bathrooms}</strong> ${this.translation.t('listing.bathroomsAbbr')}` +
      ` <span class="sep">|</span> <strong>${listing.areaSqm}</strong> m²`;
    body.appendChild(statsEl);

    const titleEl = document.createElement('p');
    titleEl.className = 'map-info-title';
    titleEl.textContent = listing.title;
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', navigate);
    body.appendChild(titleEl);

    const addressEl = document.createElement('p');
    addressEl.className = 'map-info-address';
    addressEl.textContent = listing.address;
    body.appendChild(addressEl);

    container.appendChild(body);

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  // Also wired to the "recenter" map button (template), not just the initial load — so
  // wrapped in zone.run since the geolocation callback isn't guaranteed to run inside
  // Angular's zone, and locatingMe is bound in the template. notifyOnError is off for the
  // silent initial-load attempt (most first-time visitors haven't granted permission yet,
  // and a toast on page load for that would be surprising) and on for the explicit button click.
  centerOnCurrentLocation(notifyOnError = false): void {
    if (!navigator.geolocation) return;

    this.locatingMe = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.zone.run(() => {
          this.locatingMe = false;
          const here = { lat: position.coords.latitude, lng: position.coords.longitude };
          this.map?.setCenter(here);
          this.map?.setZoom(DEFAULT_ZOOM);

          if (this.myLocationMarker) {
            this.myLocationMarker.setPosition(here);
            // Title isn't reactive like the template — refresh it too, in case the user
            // switched language since the marker was first created.
            this.myLocationMarker.setTitle(this.translation.t('map.myLocation'));
          } else {
            this.myLocationMarker = new google.maps.Marker({
              position: here,
              map: this.map,
              title: this.translation.t('map.myLocation'),
              icon: { url: MY_LOCATION_ICON, scaledSize: new google.maps.Size(32, 32) },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + 1
            });
          }
        });
      },
      () => {
        // Denied, unavailable, or timed out: keep wherever the map currently is.
        this.zone.run(() => {
          this.locatingMe = false;
          if (notifyOnError) {
            this.notification.error('map.locationError');
          }
        });
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

  togglePoiChecklist(): void {
    this.showPoiChecklist.update((visible) => !visible);
  }

  // Searches once per check, not on every pan/zoom — each search is a billed Places API call,
  // so refreshing continuously as the map moves would be needlessly expensive. Uncheck/check
  // again (or a future dedicated "refresh" affordance) re-searches the current view.
  togglePoiCategory(key: PoiCategoryKey, checked: boolean): void {
    this.checkedPoiCategories.update((set) => {
      const next = new Set(set);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

    if (checked) {
      this.searchPoiCategory(key);
    } else {
      // Bumping the request id invalidates any in-flight search so a late response can't
      // resurrect markers (or the "loading" state) for a category that's no longer checked.
      this.poiRequestIds.set(key, (this.poiRequestIds.get(key) ?? 0) + 1);
      this.loadingPoiCategories.update((set) => {
        const next = new Set(set);
        next.delete(key);
        return next;
      });
      this.clearPoiCategoryMarkers(key);
    }
  }

  private searchPoiCategory(key: PoiCategoryKey): void {
    const config = POI_CATEGORIES.find((c) => c.key === key);
    const bounds = this.map?.getBounds();
    if (!config || !this.map || !bounds) return;

    this.loadingPoiCategories.update((set) => new Set(set).add(key));
    const requestId = (this.poiRequestIds.get(key) ?? 0) + 1;
    this.poiRequestIds.set(key, requestId);

    const service = new google.maps.places.PlacesService(this.map);
    service.nearbySearch({ bounds, type: config.placeType }, (results, status) => {
      this.zone.run(() => {
        // Ignore responses to superseded searches (e.g. the user unchecked/rechecked, or
        // panned and re-triggered a search, before this one came back) — otherwise a slower
        // request can overwrite fresher markers with results from a stale viewport.
        if (requestId !== this.poiRequestIds.get(key)) return;

        this.loadingPoiCategories.update((set) => {
          const next = new Set(set);
          next.delete(key);
          return next;
        });
        this.clearPoiCategoryMarkers(key);

        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;

        const markers: google.maps.Marker[] = [];
        for (const place of results) {
          if (!place.geometry?.location) continue;
          const name = place.name ?? '';
          const marker = new google.maps.Marker({
            position: place.geometry.location,
            title: name,
            icon: config.icon
          });
          marker.addListener('click', () => this.zone.run(() => this.openPoiInfo(name, marker)));
          markers.push(marker);
        }
        this.getPoiClusterer(key).addMarkers(markers);
      });
    });
  }

  private getPoiClusterer(key: PoiCategoryKey): MarkerClusterer {
    let clusterer = this.poiClusterers.get(key);
    if (!clusterer) {
      const config = POI_CATEGORIES.find((c) => c.key === key)!;
      clusterer = new MarkerClusterer({
        map: this.map,
        algorithmOptions: CLUSTER_ALGORITHM_OPTIONS,
        renderer: createClusterRenderer(config.clusterColor)
      });
      this.poiClusterers.set(key, clusterer);
    }
    return clusterer;
  }

  private openPoiInfo(name: string, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;

    // textContent (not innerHTML) — the place name comes from the Places API, not our own data.
    const container = document.createElement('div');
    container.className = 'map-info-poi';
    container.textContent = name;

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  private clearPoiCategoryMarkers(key: PoiCategoryKey): void {
    this.poiClusterers.get(key)?.clearMarkers();
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
    const digits = applyCurrencyMask(target);
    this.minPrice.set(digits === '' ? null : Number(digits));
  }

  setMaxPrice(target: HTMLInputElement): void {
    const digits = applyCurrencyMask(target);
    this.maxPrice.set(digits === '' ? null : Number(digits));
  }

  setMinBeds(value: string): void {
    this.minBeds.set(value === 'any' ? 'any' : Number(value));
  }

  setMinBaths(value: string): void {
    this.minBaths.set(value === 'any' ? 'any' : Number(value));
  }

  setCompanyFilter(term: string): void {
    this.companyFilter.set(term);
  }

  toggleSaveSearchForm(): void {
    this.showSaveSearchForm.update((v) => !v);
  }

  setSaveSearchName(name: string): void {
    this.saveSearchName.set(name);
  }

  saveCurrentSearch(): void {
    const name = this.saveSearchName().trim();
    if (!name) return;

    const type = this.typeFilter();
    const propertyType = this.propertyTypeFilter();
    const minBd = this.minBeds();
    const minBa = this.minBaths();

    this.savedSearchService
      .create({
        name,
        listingType: type === 'all' ? undefined : type,
        propertyType: propertyType === 'all' ? undefined : propertyType,
        minPrice: this.minPrice() ?? undefined,
        maxPrice: this.maxPrice() ?? undefined,
        minBedrooms: minBd === 'any' ? undefined : minBd,
        minBathrooms: minBa === 'any' ? undefined : minBa
      })
      .subscribe({
        next: () => {
          this.notification.success('savedSearches.saved');
          this.saveSearchName.set('');
          this.showSaveSearchForm.set(false);
        },
        error: () => this.notification.error('savedSearches.saveError')
      });
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
