import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ComparisonService } from '../../../core/services/comparison.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { logicalKeyForSlug } from '../../../core/routing/route-slugs';

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
  protected readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  // Hidden on /compare or /comparar itself (either language) — showing a floating "go compare"
  // bar on top of the comparison table it would just re-navigate to is redundant.
  protected readonly onComparisonPage = signal(this.isComparisonUrl(this.router.url));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.onComparisonPage.set(this.isComparisonUrl((e as NavigationEnd).urlAfterRedirects));
    });
  }

  // Exact-segment match (via the same reverse lookup the navbar's language toggle uses), not a
  // raw prefix check — a future route whose slug merely starts with "compare"/"comparar" (e.g.
  // "compare-plans") must not be mistaken for this page.
  private isComparisonUrl(url: string): boolean {
    const [firstSegment] = url.split('?')[0].split('/').filter(Boolean);
    return !!firstSegment && logicalKeyForSlug(firstSegment) === 'compare';
  }

  goToComparison(): void {
    this.router.navigateByUrl(this.translation.path('compare'));
  }
}
