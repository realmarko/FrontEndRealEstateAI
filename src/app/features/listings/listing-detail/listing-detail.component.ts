import { Component, ElementRef, Injector, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { ListingService } from '../../../core/services/listing.service';
import { MessageService } from '../../../core/services/message.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { DEFAULT_LISTING_IMAGE, Listing } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';
import { ContactFormValue, ContactModalComponent } from '../../../shared/components/contact-modal/contact-modal.component';
import { MortgageCalculatorComponent } from '../../../shared/components/mortgage-calculator/mortgage-calculator.component';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, TranslatePipe, ContactModalComponent, MortgageCalculatorComponent],
  templateUrl: './listing-detail.component.html',
  styleUrl: './listing-detail.component.css'
})
export class ListingDetailComponent {
  @ViewChild('locationMap') private locationMapEl?: ElementRef<HTMLDivElement>;

  private readonly injector = inject(Injector);
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
  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;

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
