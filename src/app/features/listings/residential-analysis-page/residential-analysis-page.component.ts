import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveToast } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { ListingService } from '../../../core/services/listing.service';
import { SeoService } from '../../../core/services/seo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { Listing, ResidentialAnalysis, isHouseOrApartmentPropertyType } from '../../../core/models/listing.model';

// House/apartment counterpart to ViabilityReportPageComponent — comparables-based pricing
// instead of per-business-type scoring. Its own route for the same reason the commercial report
// has one: a shareable, linkable destination, not a detail-page accordion.
@Component({
  selector: 'app-residential-analysis-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe],
  templateUrl: './residential-analysis-page.component.html',
  styleUrl: './residential-analysis-page.component.css'
})
export class ResidentialAnalysisPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly listingService = inject(ListingService);
  private readonly seo = inject(SeoService);
  private readonly notification = inject(NotificationService);
  protected readonly translation = inject(TranslationService);

  // Same RouteReuseStrategy reasoning as ViabilityReportPageComponent's own id tracking: this
  // instance is reused across navigations between two listings' reports.
  private id = '';
  private lastLoadedId: string | null = null;
  // Guards against an out-of-order response after a fast navigation between two listings'
  // reports (this instance is reused across them — see loadListing's own RouteReuseStrategy
  // note): incremented on every loadListing call, captured locally, and checked before each
  // async callback mutates state. Same convention as InquiryService/FavoritesService's own
  // refreshSequence (see CLAUDE.md).
  private loadSequence = 0;

  readonly listing = signal<Listing | null>(null);
  readonly loading = signal(true);
  readonly notEligible = signal(false);

  readonly analysis = signal<ResidentialAnalysis | null>(null);
  readonly loadingAnalysis = signal(false);
  readonly analysisError = signal(false);

  private loadingToast: ActiveToast<unknown> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dismissLoadingToast());

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const nextId = params.get('id') ?? '';
      if (nextId === this.lastLoadedId) return;
      this.lastLoadedId = nextId;
      this.loadListing(nextId);
    });
  }

  private loadListing(id: string): void {
    this.id = id;
    this.resetForNewListing();
    const sequence = ++this.loadSequence;

    this.listingService.fetchById(id).subscribe({
      next: (listing) => {
        if (sequence !== this.loadSequence) return;
        this.listing.set(listing);
        this.loading.set(false);

        if (!isHouseOrApartmentPropertyType(listing.propertyType)) {
          this.notEligible.set(true);
          return;
        }

        this.seo.set({
          title: `${this.translation.t('residentialAnalysisPage.seoTitlePrefix')} ${listing.title}`,
          description: this.translation.t('residentialAnalysisPage.seoDescription'),
          path: `/listings/${listing.id}/analisis-residencial`
        });

        this.loadAnalysis(sequence);
      },
      error: () => {
        if (sequence !== this.loadSequence) return;
        this.loading.set(false);
      }
    });
  }

  private resetForNewListing(): void {
    this.dismissLoadingToast();
    this.listing.set(null);
    this.loading.set(true);
    this.notEligible.set(false);
    this.analysis.set(null);
    this.loadingAnalysis.set(false);
    this.analysisError.set(false);
  }

  private loadAnalysis(sequence: number): void {
    this.loadingAnalysis.set(true);
    this.analysisError.set(false);
    this.loadingToast = this.notification.loading('residentialAnalysisPage.loadingAnalysis');

    this.listingService.getResidentialAnalysisPreview(this.id).subscribe({
      next: (analysis) => {
        this.dismissLoadingToast();
        if (sequence !== this.loadSequence) return;
        this.loadingAnalysis.set(false);
        this.analysis.set(analysis);
      },
      error: () => {
        this.dismissLoadingToast();
        if (sequence !== this.loadSequence) return;
        this.loadingAnalysis.set(false);
        this.analysisError.set(true);
        this.notification.error('residentialAnalysisPage.analysisError');
      }
    });
  }

  private dismissLoadingToast(): void {
    if (!this.loadingToast) return;
    this.notification.dismiss(this.loadingToast);
    this.loadingToast = null;
  }

  // Direct, ungated download — same window.open pattern as the viability report's own PDF button.
  downloadResidentialAnalysisPdf(): void {
    window.open(`${environment.apiUrl}/listings/${this.id}/residential-analysis-pdf`, '_blank');
  }
}
