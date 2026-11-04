import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEFAULT_LISTING_IMAGE, Listing } from '../../../core/models/listing.model';
import { LandUseCategoryService } from '../../../core/services/land-use-category.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_INTEREST_RATE_PERCENT,
  DEFAULT_TERM_YEARS,
  calculateMonthlyPayment
} from '../../../shared/utils/mortgage';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, TranslatePipe],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.css'
})
export class ListingCardComponent {
  @Input({ required: true }) listing!: Listing;
  @Input() isFavorite = false;
  @Output() toggleFavorite = new EventEmitter<string>();
  @Input() isComparing = false;
  // Disables (rather than hides) the checkbox once MAX_COMPARE_LISTINGS is reached, for every
  // card except ones already selected — same reasoning as a disabled "add" button elsewhere:
  // the limit should be discoverable in place, not silently unclickable with no explanation.
  @Input() compareDisabled = false;
  @Output() toggleCompare = new EventEmitter<string>();

  private readonly landUseCategoryService = inject(LandUseCategoryService);

  protected readonly defaultImage = DEFAULT_LISTING_IMAGE;
  readonly activeImageIndex = signal(0);

  // Root-scoped LandUseCategoryService fetches its catalog once for the whole app — every card
  // just does a synchronous lookup against the shared cached signal, not its own HTTP request.
  // A plain getter (not `computed`), like estimatedMonthlyPayment below: `listing` is a regular
  // @Input, not a signal, so `computed` wouldn't know to re-run when it changes.
  get landUseCategoryName(): string | null {
    const id = this.listing.landUseCategoryId;
    if (id == null) return null;
    return this.landUseCategoryService.categories().find((c) => c.id === id)?.name ?? null;
  }

  showImage(index: number): void {
    this.activeImageIndex.set(index);
  }

  // Minimum horizontal travel (px) before a touch is treated as a swipe rather than a tap/scroll
  // jitter. No vertical-dominance check needed: .card-media has no vertical scroll of its own, so
  // a mostly-vertical drag here is just the page scrolling and never reaches touchend with enough
  // horizontal delta to cross this threshold.
  private static readonly SWIPE_THRESHOLD_PX = 40;
  private touchStartX: number | null = null;

  onGalleryTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onGalleryTouchEnd(event: TouchEvent): void {
    if (this.touchStartX == null) return;
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    this.touchStartX = null;

    const count = this.listing.imageUrls.length;
    if (count < 2 || Math.abs(deltaX) < ListingCardComponent.SWIPE_THRESHOLD_PX) return;

    const current = this.activeImageIndex();
    const next = deltaX < 0 ? (current + 1) % count : (current - 1 + count) % count;
    this.activeImageIndex.set(next);
  }

  // Same default assumptions as MortgageCalculatorComponent (20% down, 10.5%, 30yr) — this
  // is a quick informational estimate on the card, not an editable calculator.
  get estimatedMonthlyPayment(): number {
    return calculateMonthlyPayment(
      this.listing.price,
      DEFAULT_DOWN_PAYMENT_PERCENT,
      DEFAULT_INTEREST_RATE_PERCENT,
      DEFAULT_TERM_YEARS
    );
  }
}
