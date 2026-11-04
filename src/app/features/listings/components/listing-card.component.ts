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

  // Jumps straight to a photo (dot click) or eases into it (swipe) — both go through the same
  // crossfade so the motion language stays consistent regardless of how the user picked it.
  showImage(index: number): void {
    this.crossfadeTo(index);
  }

  // Minimum horizontal travel (px) before a touch is treated as a swipe rather than a tap.
  readonly SWIPE_THRESHOLD_PX = 40;
  // Minimum travel (either axis) before we commit to a direction. Below this a diagonal finger
  // wobble can't yet be classified, so we just wait for more movement.
  readonly DIRECTION_LOCK_PX = 10;
  // How long the outgoing photo takes to fade away, revealing the new one underneath. Bound into
  // the template's transition-duration too, so the CSS and the setTimeout that cleans up the
  // outgoing layer afterward can never drift out of sync with each other. Public (not protected)
  // so the spec can tick() this exact duration instead of guessing/duplicating a magic number.
  readonly FADE_DURATION_MS = 220;

  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  // Real swipes are rarely perfectly horizontal. Once a few px of movement reveal the gesture is
  // more horizontal than vertical, this locks 'horizontal' and we preventDefault() on further
  // touchmove — otherwise the browser's own scroll-gesture recognizer takes over on the first bit
  // of vertical drift, firing touchcancel instead of touchend, and the photo never changes.
  private swipeDirection: 'horizontal' | 'vertical' | null = null;

  // The outgoing photo, kept mounted (stacked above the new current one) only while it's fading
  // out; null the rest of the time so idle cards never carry a second <img>.
  readonly fadeFromIndex = signal<number | null>(null);
  // Starts false so the outgoing photo mounts at full opacity, then flips true one frame later —
  // see crossfadeTo for why that two-step is needed for the fade to actually animate.
  readonly fadeOutActive = signal(false);
  // If a new crossfade starts before a previous one has finished, its cleanup timer must not be
  // left to fire later on top of the new one — same class of bug as a stale drag-snap timer would
  // be, so settlePendingFade() below finishes it immediately instead.
  private pendingFadeTimeout: ReturnType<typeof setTimeout> | null = null;

  onGalleryTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.swipeDirection = null;
  }

  onGalleryTouchMove(event: TouchEvent): void {
    if (this.touchStartX == null || this.touchStartY == null) return;
    const deltaX = event.touches[0].clientX - this.touchStartX;
    const deltaY = event.touches[0].clientY - this.touchStartY;

    if (this.swipeDirection == null && (Math.abs(deltaX) > this.DIRECTION_LOCK_PX || Math.abs(deltaY) > this.DIRECTION_LOCK_PX)) {
      this.swipeDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }
    // Stop the page from scrolling while the user is mid-swipe through the gallery; a vertical
    // drag is left alone so the page scrolls normally.
    if (this.swipeDirection === 'horizontal') event.preventDefault();
  }

  onGalleryTouchEnd(event: TouchEvent): void {
    const startX = this.touchStartX;
    const wasHorizontal = this.swipeDirection === 'horizontal';
    this.resetSwipeTracking();
    if (startX == null || !wasHorizontal) return;

    const deltaX = event.changedTouches[0].clientX - startX;
    const count = this.listing.imageUrls.length;
    if (count < 2 || Math.abs(deltaX) < this.SWIPE_THRESHOLD_PX) return;

    const current = this.activeImageIndex();
    const next = deltaX < 0 ? (current + 1) % count : (current - 1 + count) % count;
    this.crossfadeTo(next);
  }

  onGalleryTouchCancel(): void {
    this.resetSwipeTracking();
  }

  private crossfadeTo(nextIndex: number): void {
    this.settlePendingFade();
    const current = this.activeImageIndex();
    if (current === nextIndex) return;

    this.fadeFromIndex.set(current);
    this.fadeOutActive.set(false); // mount the outgoing photo fully opaque first...
    this.activeImageIndex.set(nextIndex);
    requestAnimationFrame(() => this.fadeOutActive.set(true)); // ...then fade it out next frame.

    this.pendingFadeTimeout = setTimeout(() => {
      this.pendingFadeTimeout = null;
      this.fadeFromIndex.set(null);
      this.fadeOutActive.set(false);
    }, this.FADE_DURATION_MS);
  }

  // Runs an in-flight crossfade's cleanup immediately instead of leaving its timer queued —
  // called before a new one starts, so an outgoing layer from a previous fade can never still be
  // sitting on top, half-faded, when the next one begins.
  private settlePendingFade(): void {
    if (this.pendingFadeTimeout == null) return;
    clearTimeout(this.pendingFadeTimeout);
    this.pendingFadeTimeout = null;
    this.fadeFromIndex.set(null);
    this.fadeOutActive.set(false);
  }

  private resetSwipeTracking(): void {
    this.touchStartX = null;
    this.touchStartY = null;
    this.swipeDirection = null;
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
