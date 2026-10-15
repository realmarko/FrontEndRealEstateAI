import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ComparisonService } from '../../../core/services/comparison.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

// Global floating bar (mounted once in App, alongside the navbar) rather than something each
// page embeds — the comparison selection spans listing-list, map-view, favorites, and every
// agent/agency/owner profile grid, so there's no single "right" page to own it.
@Component({
  selector: 'app-compare-bar',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './compare-bar.component.html',
  styleUrl: './compare-bar.component.css'
})
export class CompareBarComponent {
  protected readonly comparison = inject(ComparisonService);
  private readonly router = inject(Router);

  // Hidden on /comparar itself — showing a floating "go compare" bar on top of the comparison
  // table it would just re-navigate to is redundant, not a second useful affordance.
  protected readonly onComparisonPage = signal(this.router.url.startsWith('/comparar'));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.onComparisonPage.set((e as NavigationEnd).urlAfterRedirects.startsWith('/comparar'));
    });
  }

  goToComparison(): void {
    this.router.navigate(['/comparar']);
  }
}
