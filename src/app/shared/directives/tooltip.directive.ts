import { Directive, ElementRef, HostListener, Input, OnDestroy, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

/**
 * Accessible label for an icon-only button — `[appTooltip]="'some.i18n.key'"`. Shows a small
 * bubble with the translated text on hover/focus (desktop, where a mouse can linger) AND on
 * touchstart (tablet/phone, which has no hover at all — see CSS `(hover: hover)` below for how
 * the two never show at once). The touch path never calls preventDefault, so the element's own
 * (click) handler still fires normally; the bubble is purely informational and auto-hides a
 * moment later. Always pair with the same string on [attr.aria-label] — this directive is a
 * sighted-user affordance, not a substitute for one (screen readers already read aria-label).
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') key = '';

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly translation = inject(TranslationService);
  private bubble: HTMLDivElement | null = null;
  private hideTimeout?: ReturnType<typeof setTimeout>;

  @HostListener('mouseenter') onMouseEnter(): void {
    this.show();
  }

  @HostListener('mouseleave') onMouseLeave(): void {
    this.hide();
  }

  @HostListener('focus') onFocus(): void {
    this.show();
  }

  @HostListener('blur') onBlur(): void {
    this.hide();
  }

  // Shows the same bubble briefly on tap instead of hover — long enough to read a short label,
  // short enough to not linger over whatever the tap's own click handler does next.
  @HostListener('touchstart') onTouchStart(): void {
    this.show();
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hide(), 1800);
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private show(): void {
    if (this.bubble || !this.key) return;

    const bubble = document.createElement('div');
    bubble.className = 'app-tooltip-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = this.translation.t(this.key);
    document.body.appendChild(bubble);
    this.bubble = bubble;
    this.position(bubble);
  }

  // Fixed-positioned against the host's own bounding rect (not CSS position:absolute relative to
  // the host) so this escapes any ancestor's overflow/stacking context — the map toolbar's
  // buttons sit over a Google Map, whose own internal layers can otherwise out-stack a plain
  // absolutely-positioned child.
  private position(bubble: HTMLDivElement): void {
    const hostRect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const top = hostRect.top - bubbleRect.height - 8;
    const left = hostRect.left + hostRect.width / 2 - bubbleRect.width / 2;
    const margin = 4;
    bubble.style.top = `${Math.max(margin, top)}px`;
    bubble.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - bubbleRect.width - margin))}px`;
  }

  private hide(): void {
    clearTimeout(this.hideTimeout);
    this.bubble?.remove();
    this.bubble = null;
  }
}
