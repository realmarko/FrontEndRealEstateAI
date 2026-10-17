import { Component, DestroyRef, ElementRef, Injector, NgZone, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ListingService } from '../../../core/services/listing.service';
import { InquiryService } from '../../../core/services/inquiry.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { DEFAULT_LISTING_IMAGE, Listing, PriceHistoryEntry, isLandOrCommercialPropertyType, isPureLandPropertyType } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';
import { ContactFormValue, ContactModalComponent } from '../../../shared/components/contact-modal/contact-modal.component';
import { TransferListingModalComponent } from '../../../shared/components/transfer-listing-modal/transfer-listing-modal.component';
import { Agent } from '../../../core/models/agent.model';
import { MortgageCalculatorComponent } from '../../../shared/components/mortgage-calculator/mortgage-calculator.component';
import { RoiCalculatorComponent } from '../../../shared/components/roi-calculator/roi-calculator.component';
import { ListingGridComponent } from '../../../shared/components/listing-grid/listing-grid.component';
import { QrCodeModalComponent } from '../../../shared/components/qr-code-modal/qr-code-modal.component';
import { WhatsAppButtonComponent } from '../../../shared/components/whatsapp-button/whatsapp-button.component';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';
import { LandUseCategoryService } from '../../../core/services/land-use-category.service';
import { PipelineService } from '../../../core/services/pipeline.service';
import { SaleProcessCreateInput } from '../../../core/models/pipeline.model';
import { NewDealModalComponent } from '../../pipeline/new-deal-modal/new-deal-modal.component';
import { shouldRecordView } from '../../../core/utils/view-dedup';
import { environment } from '../../../../environments/environment';

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

// Recognizes youtube.com/watch, youtu.be, and already-an-embed-link youtube.com/embed URLs.
// Returns null for anything else (Matterport, Vimeo, a raw video file, ...), which the
// template treats as "no embeddable preview" and falls back to a plain external link instead.
function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, TranslatePipe, ContactModalComponent, TransferListingModalComponent, MortgageCalculatorComponent, RoiCalculatorComponent, ListingGridComponent, QrCodeModalComponent, WhatsAppButtonComponent, NewDealModalComponent],
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
  private readonly inquiryService = inject(InquiryService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly seo = inject(SeoService);
  private readonly landUseCategoryService = inject(LandUseCategoryService);
  protected readonly pipeline = inject(PipelineService);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly listing = signal<Listing | undefined>(undefined);
  readonly loading = signal(true);
  readonly isFavorite = computed(() => this.favorites.isFavorite(this.id));
  readonly isOwner = computed(() => this.listing()?.ownerId === this.auth.currentUser()?.id);
  readonly isAdmin = computed(() => this.auth.currentUser()?.roles.includes('Admin') ?? false);
  readonly isAgent = computed(() => this.auth.currentUser()?.roles.includes('Agent') ?? false);
  // Only meaningful once pipeline.refresh() has populated processes() — triggered below, in the
  // listing-load success handler, but only for an owner who's also an Agent (the only case the
  // "Add to pipeline" button in the template is shown for).
  readonly inPipeline = computed(() => this.pipeline.processes().some((p) => p.listingId === this.id));
  readonly showPipelineModal = signal(false);
  readonly savingPipelineDeal = signal(false);

  // Only YouTube links get an inline player (see getYouTubeVideoId) — anything else falls
  // back to a plain "open in new tab" link in the template.
  readonly videoEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.listing()?.videoTourUrl;
    if (!url) return null;
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
  });
  readonly activePhotoIndex = signal(0);
  // Holds the photo being replaced for just long enough to crossfade under the new one (see
  // changePhoto below) — null the rest of the time, when only the current photo is rendered.
  readonly previousPhotoUrl = signal<string | null>(null);
  private photoFadeTimeout?: ReturnType<typeof setTimeout>;
  readonly showContactModal = signal(false);
  readonly sendingContact = signal(false);
  // Which flow the open contact modal feeds into — set by whichever card's button opened it
  // (see openContactModal below), read by the template to route (sent) to the right handler.
  readonly contactingOwner = signal(false);
  readonly showTransferModal = signal(false);
  readonly transferring = signal(false);
  readonly showQrModal = signal(false);
  readonly priceHistory = signal<PriceHistoryEntry[]>([]);
  readonly similarListings = signal<Listing[]>([]);
  readonly nearbySchools = signal<NearbySchool[]>([]);
  readonly schoolsLoaded = signal(false);
  readonly streetViewAvailable = signal(false);
  readonly streetViewChecked = signal(false);
  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;
  readonly isLandOrCommercial = computed(() => isLandOrCommercialPropertyType(this.listing()?.propertyType));
  readonly isPureLand = computed(() => isPureLandPropertyType(this.listing()?.propertyType));

  // Points straight at the backend's anonymous PDF endpoint (not the listing-detail page) —
  // scanning the printed QR should hand over the fact sheet immediately, with no detour
  // through the site. Absolute by construction: environment.apiUrl is always a full origin
  // in every deployed environment (only the local default is relative, and this QR is never
  // printed from there).
  readonly qrCodeUrl = computed(() => `${environment.apiUrl}/listings/${this.id}/fact-sheet.pdf`);

  // Root-scoped LandUseCategoryService fetches this once for the whole app — read its cached
  // signal directly instead of firing a second, redundant request here.
  readonly landUseCategoryName = computed(() => {
    const id = this.listing()?.landUseCategoryId;
    if (id == null) return null;
    return this.landUseCategoryService.categories().find((c) => c.id === id)?.name ?? null;
  });

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

  // Fallback avatar when the agent has no photo — same initials rule as AgentCardComponent.
  get agentInitials(): string {
    return (this.listing()?.ownerName ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  // Same initials rule as agentInitials above, for the admin-set owner-contact card.
  get ownerContactInitials(): string {
    return (this.listing()?.ownerContactName ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.photoFadeTimeout) clearTimeout(this.photoFadeTimeout);
    });

    this.listingService.fetchById(this.id).subscribe({
      next: (listing) => {
        this.listing.set(listing);

        this.seo.set({
          title: `${listing.title} - ${listing.address}`,
          description: listing.description
            ? listing.description
            : `${listing.title} en ${listing.type === 'rent' ? 'renta' : 'venta'} en ${listing.address}.`,
          path: `/listings/${listing.id}`,
          image: listing.imageUrls[0],
          type: 'article',
          structuredData: this.buildStructuredData(listing)
        });

        // Reset in case this component instance is ever reused for a different listing
        // (e.g. a future "similar listings" link) — a stale index into a shorter photo
        // array would otherwise read past the end and break the image.
        this.activePhotoIndex.set(0);
        this.loading.set(false);

        // Populates pipeline.processes() so inPipeline() above can tell whether this listing
        // already has a deal, before the owner ever opens the "Add to pipeline" modal — only
        // worth the call for an agent viewing their own listing, the one case that button shows.
        if (listing.ownerId === this.auth.currentUser()?.id && this.isAgent()) {
          this.pipeline.refresh();
        }

        if (shouldRecordView(`listing_${this.id}`)) {
          this.listingService.recordView(this.id).subscribe({ error: () => {} });
        }

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
    this.listingService.getSimilar(this.id).subscribe((listings) => this.similarListings.set(listings));
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

  viewOnMap(): void {
    const listing = this.listing();
    if (!listing || listing.lat == null || listing.lng == null) return;
    this.router.navigate(['/map'], {
      queryParams: { listingId: listing.id, lat: listing.lat, lng: listing.lng }
    });
  }

  // A short, display-friendly stand-in for the listing's real GUID — matches the compact
  // numeric-looking property ID shown on Vivanuncios/Inmuebles24-style fact grids.
  shortId(id: string): string {
    return id.slice(0, 8).toUpperCase();
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

  openQrModal(): void {
    this.showQrModal.set(true);
  }

  closeQrModal(): void {
    this.showQrModal.set(false);
  }

  whatsappMessage(): string {
    return this.translation.t('listingDetail.whatsappMessage', { title: this.listing()?.title ?? '' });
  }

  pricePerSqm(listing: Listing): number {
    return listing.areaSqm > 0 ? listing.price / listing.areaSqm : 0;
  }

  // schema.org RealEstateListing — the structured-data equivalent of the fact grid already
  // rendered on this page, so a search result can show price/beds/baths as a rich snippet.
  // offers is omitted entirely for a price-on-request listing rather than sent as 0/null, since
  // neither represents a real price and either could render as "Free" in a rich result.
  private buildStructuredData(listing: Listing): Record<string, unknown> {
    return {
      '@type': 'RealEstateListing',
      name: listing.title,
      description: listing.description || undefined,
      url: `${this.seo.origin}/listings/${listing.id}`,
      image: listing.imageUrls.length ? listing.imageUrls : undefined,
      datePosted: listing.createdAt,
      address: {
        '@type': 'PostalAddress',
        streetAddress: listing.street || undefined,
        addressLocality: listing.city || undefined,
        addressRegion: listing.state || undefined,
        postalCode: listing.zipCode || undefined,
        addressCountry: listing.country || undefined
      },
      geo:
        listing.lat != null && listing.lng != null
          ? { '@type': 'GeoCoordinates', latitude: listing.lat, longitude: listing.lng }
          : undefined,
      offers:
        !listing.priceOnRequest && listing.price > 0
          ? {
              '@type': 'Offer',
              price: listing.price,
              priceCurrency: listing.currency,
              availability: 'https://schema.org/InStock'
            }
          : undefined,
      numberOfBedroomsTotal: listing.bedrooms || undefined,
      numberOfBathroomsTotal: listing.bathrooms || undefined,
      floorSize: listing.areaSqm > 0 ? { '@type': 'QuantitativeValue', value: listing.areaSqm, unitCode: 'MTK' } : undefined
    };
  }

  daysOnMarket(listing: Listing): number {
    const createdAt = new Date(listing.createdAt).getTime();
    // Math.max guards against clock skew between client and server making this negative.
    return Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
  }

  showPhoto(index: number): void {
    this.changePhoto(index);
  }

  nextPhoto(): void {
    const count = this.listing()?.imageUrls.length ?? 0;
    if (count < 2) return;
    this.changePhoto((this.activePhotoIndex() + 1) % count);
  }

  previousPhoto(): void {
    const count = this.listing()?.imageUrls.length ?? 0;
    if (count < 2) return;
    this.changePhoto((this.activePhotoIndex() - 1 + count) % count);
  }

  private touchStartX = 0;
  private touchStartY = 0;

  onPhotoTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  // Only commits to a photo change once the gesture is clearly a deliberate horizontal swipe
  // (past a small threshold, and more horizontal than vertical) — otherwise a vertical page
  // scroll that happens to start on the photo would flip photos by accident.
  onPhotoTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      this.nextPhoto();
    } else {
      this.previousPhoto();
    }
  }

  // Keeps the outgoing photo rendered (see previousPhotoUrl) just long enough for the incoming
  // one to fade in on top of it, instead of the two swapping instantly. The 220ms timeout mirrors
  // the CSS fade-in duration in listing-detail.component.css — the old photo is only removed once
  // the new one has fully covered it.
  private changePhoto(index: number): void {
    const urls = this.listing()?.imageUrls;
    if (!urls || index === this.activePhotoIndex()) return;
    if (this.photoFadeTimeout) clearTimeout(this.photoFadeTimeout);
    this.previousPhotoUrl.set(urls[this.activePhotoIndex()] ?? this.defaultImage);
    this.activePhotoIndex.set(index);
    this.photoFadeTimeout = setTimeout(() => this.previousPhotoUrl.set(null), 220);
  }

  openTransferModal(): void {
    this.showTransferModal.set(true);
  }

  closeTransferModal(): void {
    if (this.transferring()) return;
    this.showTransferModal.set(false);
  }

  transferListing(agent: Agent): void {
    this.transferring.set(true);
    this.listingService.transfer(this.id, agent.id).subscribe({
      next: (listing) => {
        this.transferring.set(false);
        this.showTransferModal.set(false);
        this.listing.set(listing);
        this.notification.success('listingDetail.transferSuccess', { name: agent.name });
      },
      error: () => {
        this.transferring.set(false);
        this.notification.error('listingDetail.transferError');
      }
    });
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

  openPipelineModal(): void {
    this.showPipelineModal.set(true);
  }

  closePipelineModal(): void {
    if (this.savingPipelineDeal()) return;
    this.showPipelineModal.set(false);
  }

  savePipelineDeal(input: SaleProcessCreateInput): void {
    this.savingPipelineDeal.set(true);
    this.pipeline.create(input).subscribe({
      next: () => {
        this.savingPipelineDeal.set(false);
        this.showPipelineModal.set(false);
        this.notification.success('listingDetail.addedToPipeline');
      },
      error: () => {
        this.savingPipelineDeal.set(false);
        this.notification.error('listingDetail.addToPipelineError');
      }
    });
  }

  openContactModal(contactOwner = false): void {
    this.contactingOwner.set(contactOwner);
    this.showContactModal.set(true);
  }

  // Routes the shared contact-modal's single (sent) output to whichever flow opened it —
  // contactingOwner is set by openContactModal above when the owner-contact card's button
  // (rather than the agent card's) triggered it.
  sendContactMessage(value: ContactFormValue): void {
    if (this.contactingOwner()) {
      this.sendContactOwnerMessage(value);
    } else {
      this.sendContactAgentMessage(value);
    }
  }

  closeContactModal(): void {
    if (this.sendingContact()) return;
    this.showContactModal.set(false);
  }

  sendContactAgentMessage(value: ContactFormValue): void {
    const listing = this.listing();
    const { name, phone, email, message, fundingMethod, timeline, hasAgent } = value;

    if (!listing || !name || !phone || !email || !message || this.sendingContact()) {
      this.notification.error('contactModal.formIncomplete');
      return;
    }

    this.sendingContact.set(true);

    this.submitInquiry(
      { listingId: listing.id, senderName: name, senderEmail: email, senderPhone: phone, message, fundingMethod, timeline, hasAgent },
      {
        successKey: 'listingDetail.contactAgentSuccess',
        errorKey: 'listingDetail.contactAgentError',
        onDone: (ok) => {
          this.sendingContact.set(false);
          if (ok) this.showContactModal.set(false);
        }
      }
    );
  }

  // Direct email to the real property owner (listingService.contactOwner), not an Inquiry row —
  // only reachable when the admin has set listing.hideAgentContact (see the template), since the
  // owner typically has no account/dashboard here to read an Inquiry from.
  sendContactOwnerMessage(value: ContactFormValue): void {
    const listing = this.listing();
    const { name, phone, email, message } = value;

    if (!listing || !name || !phone || !email || !message || this.sendingContact()) {
      this.notification.error('contactModal.formIncomplete');
      return;
    }

    this.sendingContact.set(true);
    this.listingService.contactOwner(listing.id, { name, phone, email, message }).subscribe({
      next: () => {
        this.sendingContact.set(false);
        this.showContactModal.set(false);
        this.notification.success('listingDetail.contactOwnerSuccess');
      },
      error: () => {
        this.sendingContact.set(false);
        this.notification.error('listingDetail.contactOwnerError');
      }
    });
  }

  // Wraps the Inquiry submission side effect (toast + onDone reset) so sendContactAgentMessage
  // doesn't repeat it inline.
  private submitInquiry(
    input: Parameters<InquiryService['create']>[0],
    { successKey, errorKey, onDone }: { successKey: string; errorKey: string; onDone: (ok: boolean) => void }
  ): void {
    this.inquiryService.create(input).subscribe({
      next: () => {
        onDone(true);
        this.notification.success(successKey);
      },
      error: () => {
        onDone(false);
        this.notification.error(errorKey);
      }
    });
  }
}
