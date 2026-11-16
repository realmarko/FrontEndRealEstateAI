import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  GeomarketingService,
  PopulationDensity,
  SocioeconomicLevel
} from '../../../core/services/geomarketing.service';
import { SeoService } from '../../../core/services/seo.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { NICHE_BUSINESS_CATEGORIES, ZoneAnalysisZone, findZoneBySlug } from '../zone-analysis-data';

interface NicheResult {
  labelKey: string;
  count: number | null;
}

// Client-rendered on purpose (see app.routes.server.ts) — each visit calls
// GeomarketingService.businessDensity 3x (DENUE-backed, rate-limited), same reasoning as
// viability-report-page/residential-analysis-page staying out of the prerender set.
@Component({
  selector: 'app-zone-analysis-detail',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe, StatePanelComponent],
  templateUrl: './zone-analysis-detail.component.html',
  styleUrl: './zone-analysis-detail.component.css'
})
export class ZoneAnalysisDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly geomarketing = inject(GeomarketingService);
  private readonly seo = inject(SeoService);
  protected readonly translation = inject(TranslationService);

  // This instance is reused across navigations between two zones' own pages (same route config),
  // same RouteReuseStrategy reasoning as ResidentialAnalysisPageComponent's own id tracking.
  private lastLoadedSlug: string | null = null;
  // Guards against an out-of-order response after a fast navigation between two zones — see
  // CLAUDE.md's refreshSequence convention (InquiryService/FavoritesService).
  private loadSequence = 0;

  readonly zone = signal<ZoneAnalysisZone | null>(null);
  readonly notFound = signal(false);
  readonly loading = signal(true);

  readonly population = signal<PopulationDensity | null>(null);
  readonly populationUnavailable = signal(false);

  readonly niches = signal<NicheResult[]>([]);
  readonly dataError = signal(false);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      const slug = params.get('slug') ?? '';
      if (slug === this.lastLoadedSlug) return;
      this.lastLoadedSlug = slug;
      this.load(slug);
    });
  }

  private load(slug: string): void {
    const zone = findZoneBySlug(slug);
    if (!zone) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.zone.set(zone);
    this.notFound.set(false);
    this.loading.set(true);
    this.dataError.set(false);
    this.population.set(null);
    this.populationUnavailable.set(false);
    this.niches.set([]);

    this.seo.set({
      title: this.translation.t('zoneAnalysisDetail.seoTitlePrefix', { zone: zone.name }),
      description: this.translation.t('zoneAnalysisDetail.seoDescription', { zone: zone.name }),
      path: this.translation.path('zoneAnalysis', zone.slug),
      hreflang: this.translation.hreflangPaths('zoneAnalysis', zone.slug)
    });

    const sequence = ++this.loadSequence;

    const population$ = this.geomarketing.populationDensity(zone.lat, zone.lng).pipe(catchError(() => of(null)));
    const niches$ = NICHE_BUSINESS_CATEGORIES.map((category) =>
      this.geomarketing.businessDensity(category.denueSearchTerm, zone.lat, zone.lng, category.radiusMeters).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin([population$, ...niches$]).subscribe({
      next: ([populationResult, ...nicheResults]) => {
        if (sequence !== this.loadSequence) return;
        this.loading.set(false);

        if (populationResult) {
          this.population.set(populationResult);
        } else {
          this.populationUnavailable.set(true);
        }

        this.niches.set(
          NICHE_BUSINESS_CATEGORIES.map((category, index) => ({
            labelKey: category.labelKey,
            count: nicheResults[index]?.count ?? null
          }))
        );

        // Both sources failed outright (not just "no coverage here") — surface a single retry panel.
        if (!populationResult && nicheResults.every((result) => result === null)) {
          this.dataError.set(true);
        }
      },
      error: () => {
        if (sequence !== this.loadSequence) return;
        this.loading.set(false);
        this.dataError.set(true);
      }
    });
  }

  retry(): void {
    const zone = this.zone();
    if (zone) this.load(zone.slug);
  }

  viewListingsOnMap(): void {
    const zone = this.zone();
    if (!zone) return;
    this.router.navigate([this.translation.path('map')], { queryParams: { lat: zone.lat, lng: zone.lng } });
  }

  // Reuses map-view's own SOCIOECONOMIC_LEVEL_LABEL_KEYS keys rather than duplicating them here.
  socioeconomicLabelKey(level: SocioeconomicLevel): string {
    return `map.socioeconomic${level}`;
  }
}
