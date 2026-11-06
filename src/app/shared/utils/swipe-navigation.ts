// Shared gesture logic for any "one item at a time, swipe/scroll to move" carousel — first
// written for listing-detail's photo gallery, now reused by viability-report-page's business-type
// carousel (its second use, past this project's own "extract once it repeats twice" bar). Each
// consumer still owns its own index/state signals and next()/previous() methods; this class only
// turns raw wheel/touch events into calls to those two callbacks.
export class SwipeNavigator {
  constructor(private readonly next: () => void, private readonly previous: () => void) {}

  // Debounces trackpad/mouse wheel horizontal scroll so one gesture advances one item instead of
  // firing on every wheel tick.
  private wheelLocked = false;

  onWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaX) < Math.abs(event.deltaY) || Math.abs(event.deltaX) < 10) return;
    event.preventDefault();
    if (this.wheelLocked) return;
    this.wheelLocked = true;
    setTimeout(() => (this.wheelLocked = false), 300);
    if (event.deltaX > 0) {
      this.next();
    } else {
      this.previous();
    }
  }

  private touchStartX = 0;
  private touchStartY = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  // Only commits to a change once the gesture is clearly a deliberate horizontal swipe (past a
  // small threshold, and more horizontal than vertical) — otherwise a vertical page scroll that
  // happens to start over the carousel would flip items by accident.
  onTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      this.next();
    } else {
      this.previous();
    }
  }
}
