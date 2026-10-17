import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { CompareBarComponent } from './shared/components/compare-bar/compare-bar.component';
import { isBrowser } from './core/utils/platform';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CompareBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Fades the outgoing page out, then — once the router has already swapped in the new route's
  // component — fades the new page in, instead of the instant hard cut a bare <router-outlet>
  // gives you. NavigationEnd fires as soon as the route matches, which is before a routed
  // component's own data finishes loading (every page here fetches in its own constructor/
  // ngOnInit and shows its own loading state), so this never waits on page content — just the
  // route swap itself.
  readonly routeFading = signal(false);

  constructor() {
    // No requestAnimationFrame (or any real paint cycle) during SSR/prerendering — and nothing
    // to fade there either, since the server always renders a single route in one pass.
    if (!isBrowser()) return;

    const router = inject(Router);
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.routeFading.set(true);
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        // Let the new route's DOM paint one frame before fading it in, so there's something to
        // fade in rather than catching the previous frame's content.
        requestAnimationFrame(() => this.routeFading.set(false));
      }
    });
  }
}
