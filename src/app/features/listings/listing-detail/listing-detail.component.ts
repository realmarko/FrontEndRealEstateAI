import { Component, ElementRef, Injector, NgZone, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ListingService } from '../../../core/services/listing.service';
import { MessageService } from '../../../core/services/message.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { DEFAULT_LISTING_IMAGE, Listing, PriceHistoryEntry } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';
import { ContactFormValue, ContactModalComponent } from '../../../shared/components/contact-modal/contact-modal.component';
import { MortgageCalculatorComponent } from '../../../shared/components/mortgage-calculator/mortgage-calculator.component';
import { TranslationService } from '../../../core/services/translation.service';

export interface NearbySchool {
  name: string;
  vicinity?: string;
  rating?: number;
  distanceKm: number;
}

// Straight-line distance only — no need to pull in the Maps "geometry" library (a separate
// script param not currently loaded) just for this.
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, TranslatePipe, ContactModalComponent, MortgageCalculatorComponent],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.css'
})
export class ListingDetailComponent {
  @ViewChild('locationMap') private locationMapEl?: ElementRef<HTMLDivElement>;
  @ViewChild('streetView') private streetViewEl?: ElementRef<HTMLDivElement>;

  private readonly injector = inject(Injector);
  private readonly zone = inject(NgZone);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  protected readonly favorites = inject(FavoritesService);
  protected readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly listing = signal<Listing | undefined>(undefined);
  readonly loading = signal(true);
  readonly isFavorite = computed(() => this.favorites.isFavorite(this.id));
  readonly isOwner = computed(() => this.listing()?.ownerId === this.auth.currentUser()?.id);
  readonly messageBody = signal('');
  readonly activePhotoIndex = signal(0);
  readonly showContactModal = signal(false);
  readonly sendingContact = signal(false);
  readonly priceHistory = signal<PriceHistoryEntry[]>([]);
  readonly nearbySchools = signal<NearbySchool[]>([]);
  readonly schoolsLoaded = signal(false);
  readonly streetViewAvailable = signal(false);
  readonly streetViewChecked = signal(false);
  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;

  // Newest first for display (matches how Redfin/Zillow order their price-history table),
  // with each row's change computed against the entry right before it chronologically —
  // computed from the ascending `priceHistory` signal, then reversed only for display.
  readonly priceHistoryRows = computed(() => {
    const history = this.priceHistory();
    return history
      .map((entry, i) => ({
        entry,
        isFirst: i === 0,
        change: i === 0 ? 0 : entry.price - history[i - 1].price
      }))
      .reverse();
  });

  get contactModalTitle(): string {
    return this.translation.t('listingDetail.contactModalTitle', { title: this.listing()?.title ?? '' });
  }

  get contactInitialName(): string {
    const user = this.auth.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  get contactInitialEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  constructor() {
    this.listingService.fetchById(this.id).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        // Reset in case this component instance is ever reused for a different listing
        // (e.g. a future "similar listings" link) — a stale index into a shorter photo
        // array would otherwise read past the end and break the image.
        this.activePhotoIndex.set(0);
        this.loading.set(false);

        if (listing.lat != null && listing.lng != null) {
          const lat = listing.lat;
          const lng = listing.lng;
          // The map container only exists once the @if branch renders for this listing;
          // afterNextRender guarantees that render has happened before ViewChild is read,
          // unlike setTimeout(0) which can still fire before Angular updates the query.
          afterNextRender(() => this.initLocationMap(lat, lng), { injector: this.injector });
        }
      },
      error: () => {
        this.listing.set(undefined);
        this.loading.set(false);
      }
    });

    this.listingService.getPriceHistory(this.id).subscribe((history) => this.priceHistory.set(history));
  }

  private async initLocationMap(lat: number, lng: number): Promise<void> {
    if (!this.locationMapEl) return;

    await loadGoogleMaps();

    const position = { lat, lng };
    const map = new google.maps.Map(this.locationMapEl.nativeElement, {
      center: position,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      keyboardShortcuts: false,
      // Just a static-looking preview of where the listing is — no panning, zooming, or
      // dragging the marker.
      gestureHandling: 'none',
      disableDoubleClickZoom: true
    });

    new google.maps.Marker({ position, map });

    this.searchNearbySchools(map, lat, lng);
    this.initStreetView(position);
  }

  // Street View coverage is spotty (especially off main roads), so we check availability
  // first via StreetViewService instead of always creating a panorama that could come up
  // blank — the container stays hidden until we know there's real imagery to show.
  private initStreetView(position: google.maps.LatLngLiteral): void {
    if (!this.streetViewEl) return;

    const streetViewService = new google.maps.StreetViewService();
    streetViewService.getPanorama({ location: position, radius: 50 }, (data, status) => {
      this.zone.run(() => {
        this.streetViewChecked.set(true);

        if (status !== google.maps.StreetViewStatus.OK || !data?.location?.latLng || !this.streetViewEl) {
          this.streetViewAvailable.set(false);
          return;
        }

        this.streetViewAvailable.set(true);
        new google.maps.StreetViewPanorama(this.streetViewEl.nativeElement, {
          position: data.location.latLng,
          pov: { heading: 0, pitch: 0 },
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false
        });
      });
    });
  }

  // Reuses the location map instance (PlacesService needs either a Map or a plain div) and
  // the Places library already loaded alongside the base Maps script — no separate API key
  // or account needed. The "rating" shown is Google's own place rating (like any other
  // business), not an academic-quality score (e.g. GreatSchools) — we have no access to that
  // kind of data, so the template must not imply otherwise.
  private searchNearbySchools(map: google.maps.Map, lat: number, lng: number): void {
    const service = new google.maps.places.PlacesService(map);
    service.nearbySearch({ location: { lat, lng }, radius: 2000, type: 'school' }, (results, status) => {
      this.zone.run(() => {
        this.schoolsLoaded.set(true);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          this.nearbySchools.set([]);
          return;
        }

        const schools = results
          .filter((place) => place.geometry?.location)
          .map((place): NearbySchool => ({
            name: place.name ?? '',
            vicinity: place.vicinity,
            rating: place.rating,
            distanceKm: haversineDistanceKm(lat, lng, place.geometry!.location!.lat(), place.geometry!.location!.lng())
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 5);

        this.nearbySchools.set(schools);
      });
    });
  }

  toggleFavorite(): void {
    this.favorites.toggle(this.id);
  }

  async shareListing(): Promise<void> {
    const listing = this.listing();
    if (!listing) return;

    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, url });
      } catch (err) {
        // AbortError means the user dismissed the native share sheet — not an error worth
        // surfacing. Anything else (permission denied, etc.) should still notify the user,
        // same as the clipboard fallback below does on failure.
        if ((err as DOMException)?.name !== 'AbortError') {
          this.notification.error('listingDetail.shareError');
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      this.notification.success('listingDetail.linkCopied');
    } catch {
      this.notification.error('listingDetail.shareError');
    }
  }

  pricePerSqm(listing: Listing): number {
    return listing.areaSqm > 0 ? listing.price / listing.areaSqm : 0;
  }

  daysOnMarket(listing: Listing): number {
    const createdAt = new Date(listing.createdAt).getTime();
    // Math.max guards against clock skew between client and server making this negative.
    return Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
  }

  showPhoto(index: number): void {
    this.activePhotoIndex.set(index);
  }

  nextPhoto(): void {
    const count = this.listing()?.imageUrls.length ?? 0;
    if (count < 2) return;
    this.activePhotoIndex.update((i) => (i + 1) % count);
  }

  previousPhoto(): void {
    const count = this.listing()?.imageUrls.length ?? 0;
    if (count < 2) return;
    this.activePhotoIndex.update((i) => (i - 1 + count) % count);
  }

  deleteListing(): void {
    this.listingService.delete(this.id).subscribe({
      next: () => {
        this.notification.success('listingDetail.deleteSuccess');
        this.router.navigate(['/listings']);
      },
      error: () => this.notification.error('listingDetail.deleteError')
    });
  }

  sendMessage(): void {
    const listing = this.listing();
    const user = this.auth.currentUser();
    const body = this.messageBody().trim();
    if (!listing || !user || !body) {
      return;
    }

    this.messageService.sendMessage(
      listing.id,
      listing.title,
      user.id,
      `${user.firstName} ${user.lastName}`,
      body
    );
    this.messageBody.set('');
    this.notification.success('listingDetail.messageSent');
  }

  openContactModal(): void {
    this.showContactModal.set(true);
  }

  closeContactModal(): void {
    if (this.sendingContact()) return;
    this.showContactModal.set(false);
  }

  sendContactAgentMessage(value: ContactFormValue): void {
    const listing = this.listing();
    const { name, phone, email, message } = value;

    if (!listing || !name || !phone || !email || !message || this.sendingContact()) {
      this.notification.error('contactModal.formIncomplete');
      return;
    }

    this.sendingContact.set(true);

    // No agent account is linked to a listing today — the popup collects the same fields
    // as the agent-contact one, but the message lands wherever "contact about this
    // listing" already goes (the local inbox keyed by senderId, unrelated to whether the
    // sender is logged in).
    const senderId = this.auth.currentUser()?.id ?? crypto.randomUUID();
    const body = `${message}\n\n${this.translation.t('contactModal.phone')}: ${phone}\n${this.translation.t('contactModal.email')}: ${email}`;

    this.messageService.sendMessage(listing.id, listing.title, senderId, name, body);
    this.sendingContact.set(false);
    this.showContactModal.set(false);
    this.notification.success('listingDetail.contactAgentSuccess');
  }
}
