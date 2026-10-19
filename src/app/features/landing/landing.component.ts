import { afterNextRender, Component, ElementRef, NgZone, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  @ViewChild('corridor') private readonly corridorRef?: ElementRef<HTMLElement>;
  @ViewChild('how') private readonly howRef?: ElementRef<HTMLElement>;

  private readonly zone = inject(NgZone);

  constructor(protected readonly auth: AuthService, seo: SeoService) {
    seo.set({
      title: 'Casas, departamentos y terrenos en venta y renta',
      description: 'Encuentra tu próxima propiedad en México: casas, departamentos y terrenos en venta y renta, con agentes e inmobiliarias verificadas.',
      path: '/'
    });

    // afterNextRender (not AfterViewInit) because this view is server-rendered: AfterViewInit
    // can fire before hydration finishes repairing the DOM. A @ViewChild captured at that
    // point can still go stale moments later: this page's hero reads auth.isAuthenticated(),
    // which the server can't answer the same way the client can (no localStorage), so the
    // mismatch makes Angular redo this component's DOM ~25-60ms after the first render. The
    // 150ms delay — comfortably past that window — plus re-reading the ViewChild at that later
    // point rather than closing over an earlier value, is what actually dodges it.
    afterNextRender(() => {
      setTimeout(() => {
        this.revealOnScroll(this.corridorRef?.nativeElement);
        this.revealOnScroll(this.howRef?.nativeElement);
      }, 150);
    });
  }

  /**
   * Adds 'in-view' the first time `el` scrolls into the viewport; CSS handles the actual motion.
   * Also reveals unconditionally after 15s no matter what: the content starts hidden
   * (opacity: 0) waiting for this class, so if the observer never fires for any reason — a
   * browser quirk, an extension interfering with it, anything — the section must not stay
   * invisible forever. 15s is deliberately long: it's a last resort for when the observer is
   * truly broken, not a race against how long a real visitor spends reading the hero before
   * scrolling — a shorter fallback (originally 2.5s) was firing before most visitors ever
   * scrolled this far, silently replacing the scroll-triggered reveal with an always-already-
   * visible section.
   */
  private revealOnScroll(el?: HTMLElement): void {
    if (!el) {
      return;
    }
    const reveal = () => el.classList.add('in-view');
    if (typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }
    this.zone.runOutsideAngular(() => {
      const fallback = setTimeout(reveal, 15000);
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            clearTimeout(fallback);
            reveal();
            observer.disconnect();
          }
        },
        { threshold: 0.2, rootMargin: '-80px 0px' }
      );
      observer.observe(el);
    });
  }
}
