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

  // Minimum horizontal travel (px) before a touch is treated as a swipe rather than a tap.
  readonly SWIPE_THRESHOLD_PX = 40;
  // Minimum travel (either axis) before we commit to a direction. Below this a diagonal finger
  // wobble can't yet be classified, so we just wait for more movement.
  readonly DIRECTION_LOCK_PX = 10;
  // How long the snap-to-neighbor / spring-back transition takes. Bound into the template's
  // transition-duration too, so the CSS curve and the setTimeout that swaps the index afterward
  // can never drift out of sync with each other. Public (not protected) so the spec can tick()
  // this exact duration instead of guessing/duplicating a magic number.
  readonly SNAP_DURATION_MS = 240;

  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private cardMediaWidthPx = 0;
  // The pending snap/spring-back timer plus the work it'll do when it fires. If a new drag starts
  // before a previous one has finished settling, settlePendingSnap() below runs that work
  // immediately instead of leaving it to fire mid-gesture on a stale `activeImageIndex()` — a fast
  // double-swipe (flicking through several photos quickly) would otherwise glitch: the earlier
  // timer finalizing after the new drag has already moved the track for a second time.
  private pendingSnapTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingSnapSettle: (() => void) | null = null;
  // Real swipes are rarely perfectly horizontal. Once a few px of movement reveal the gesture is
  // more horizontal than vertical, this locks 'horizontal' and we preventDefault() on further
  // touchmove — otherwise the browser's own scroll-gesture recognizer takes over on the first bit
  // of vertical drift, firing touchcancel instead of touchend, and the photo never changes.
  private swipeDirection: 'horizontal' | 'vertical' | null = null;

  // Live horizontal offset (px) of the photo track: 1:1 with the finger while dragging, then
  // animated to ±cardMediaWidthPx (snap) or back to 0 (spring-back) once the finger lifts.
  readonly dragOffsetPx = signal(0);
  // The next/prev image, rendered one card-width off-screen only while a horizontal drag is in
  // progress — not preloaded for every card up front, only once the user actually swipes.
  readonly dragNeighborIndex = signal<number | null>(null);
  // True only during the post-release snap/spring-back transition — off during the drag itself,
  // so the track tracks the finger without any easing lag.
  readonly isSnapping = signal(false);

  onGalleryTouchStart(event: TouchEvent): void {
    this.settlePendingSnap();
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.swipeDirection = null;
    this.cardMediaWidthPx = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
  }

  onGalleryTouchMove(event: TouchEvent): void {
    if (this.touchStartX == null || this.touchStartY == null) return;
    const deltaX = event.touches[0].clientX - this.touchStartX;
    const deltaY = event.touches[0].clientY - this.touchStartY;

    if (this.swipeDirection == null && (Math.abs(deltaX) > this.DIRECTION_LOCK_PX || Math.abs(deltaY) > this.DIRECTION_LOCK_PX)) {
      this.swipeDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }
    if (this.swipeDirection !== 'horizontal') return;
    // Stop the page from scrolling while the user is mid-swipe through the gallery; a vertical
    // drag is left alone so the page scrolls normally.
    event.preventDefault();

    const count = this.listing.imageUrls.length;
    if (count < 2) return;
    const current = this.activeImageIndex();
    this.dragNeighborIndex.set(deltaX < 0 ? (current + 1) % count : (current - 1 + count) % count);
    this.dragOffsetPx.set(Math.max(-this.cardMediaWidthPx, Math.min(this.cardMediaWidthPx, deltaX)));
  }

  onGalleryTouchEnd(event: TouchEvent): void {
    const startX = this.touchStartX;
    const wasHorizontal = this.swipeDirection === 'horizontal';
    const neighbor = this.dragNeighborIndex();
    this.resetSwipeTracking();
    if (startX == null || !wasHorizontal || neighbor == null) {
      this.springBack();
      return;
    }

    const deltaX = event.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) < this.SWIPE_THRESHOLD_PX) {
      this.springBack();
      return;
    }
    this.snapToNeighbor(neighbor, deltaX < 0 ? -this.cardMediaWidthPx : this.cardMediaWidthPx);
  }

  onGalleryTouchCancel(): void {
    this.resetSwipeTracking();
    this.springBack();
  }

  // Finishes the drag by sliding the rest of the way onto the neighbor photo, then — once the
  // transition has had time to play — swaps it in as the active image and resets the track
  // instantly (transition off) so the swap itself is invisible: the neighbor was already sitting
  // exactly where the now-current photo snaps back to.
  private snapToNeighbor(neighborIndex: number, settledOffsetPx: number): void {
    this.isSnapping.set(true);
    this.dragOffsetPx.set(settledOffsetPx);
    this.scheduleSnapSettle(() => {
      this.activeImageIndex.set(neighborIndex);
      this.isSnapping.set(false);
      this.dragOffsetPx.set(0);
      this.dragNeighborIndex.set(null);
    });
  }

  // A swipe that didn't clear the threshold (or was cancelled) eases back to center instead of
  // jumping, so it reads as "not quite enough" rather than the gesture being silently ignored.
  private springBack(): void {
    if (this.dragOffsetPx() === 0) {
      this.dragNeighborIndex.set(null);
      return;
    }
    this.isSnapping.set(true);
    this.dragOffsetPx.set(0);
    this.scheduleSnapSettle(() => {
      this.isSnapping.set(false);
      this.dragNeighborIndex.set(null);
    });
  }

  private scheduleSnapSettle(settle: () => void): void {
    this.pendingSnapSettle = settle;
    this.pendingSnapTimeout = setTimeout(() => {
      this.pendingSnapTimeout = null;
      this.pendingSnapSettle = null;
      settle();
    }, this.SNAP_DURATION_MS);
  }

  // Runs an in-flight snap/spring-back's end state immediately instead of leaving its timer to
  // fire later — called before a new drag starts, so that drag never computes its neighbor or
  // offset against state the previous gesture hadn't actually settled into yet.
  private settlePendingSnap(): void {
    if (this.pendingSnapTimeout == null) return;
    clearTimeout(this.pendingSnapTimeout);
    this.pendingSnapTimeout = null;
    const settle = this.pendingSnapSettle;
    this.pendingSnapSettle = null;
    settle?.();
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
