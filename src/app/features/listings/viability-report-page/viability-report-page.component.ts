import { Component, ElementRef, Injector, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ListingService } from '../../../core/services/listing.service';
import { SeoService } from '../../../core/services/seo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { ViabilityReportModalComponent } from '../../../shared/components/viability-report-modal/viability-report-modal.component';
import { Listing, ViabilityAnalysis, isLandOrCommercialPropertyType } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';

// The full "Reporte de Viabilidad Comercial" — every business type, every check, not just the
// top-3 teaser shown inline on listing-detail (see its viability-section, which links here).
// Its own route/page rather than a modal or an expandable section: this is meant to be a
// shareable, linkable destination in its own right (the lead magnet's actual landing page), not
// just a detail-page accordion.
@Component({
  selector: 'app-viability-report-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe, ViabilityReportModalComponent],
  templateUrl: './viability-report-page.component.html',
  styleUrl: './viability-report-page.component.css'
})
export class ViabilityReportPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly listingService = inject(ListingService);
  private readonly seo = inject(SeoService);
  private readonly notification = inject(NotificationService);
  private readonly injector = inject(Injector);
  protected readonly translation = inject(TranslationService);

  @ViewChild('locationMap') private locationMapEl?: ElementRef<HTMLDivElement>;

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly listing = signal<Listing | null>(null);
  readonly loading = signal(true);
  readonly notEligible = signal(false);

  readonly analysis = signal<ViabilityAnalysis | null>(null);
  readonly loadingAnalysis = signal(false);
  readonly analysisError = signal(false);

  // Worst-first would bury the point of the report; best-first lets a reader (often the business
  // actually scouting this lot, not just the seller) see the strongest fits immediately.
  readonly rankedBusinesses = computed(() => [...(this.analysis()?.businesses ?? [])].sort((a, b) => b.score - a.score));

  readonly showViabilityModal = signal(false);
  readonly submittingViabilityRequest = signal(false);
  readonly viabilityRequestSent = signal(false);
  readonly viabilityReportUrl = signal<string | null>(null);

  constructor() {
    this.listingService.fetchById(this.id).subscribe({
      next: (listing) => {
        this.listing.set(listing);
        this.loading.set(false);

        if (!isLandOrCommercialPropertyType(listing.propertyType)) {
          this.notEligible.set(true);
          return;
        }

        this.seo.set({
          title: `${this.translation.t('viabilityPage.seoTitlePrefix')} ${listing.title}`,
          description: this.translation.t('viabilityPage.seoDescription'),
          path: `/listings/${listing.id}/viabilidad-comercial`
        });

        this.loadAnalysis();

        if (listing.lat != null && listing.lng != null) {
          const lat = listing.lat;
          const lng = listing.lng;
          // Same reasoning as listing-detail's own initLocationMap: the map container only
          // exists once this @else branch renders, and afterNextRender guarantees that render
          // has already happened before the ViewChild is read.
          afterNextRender(() => this.initLocationMap(lat, lng), { injector: this.injector });
        }
      },
      error: () => this.loading.set(false)
    });
  }

  private async initLocationMap(lat: number, lng: number): Promise<void> {
    if (!this.locationMapEl) return;

    await loadGoogleMaps();

    const position = { lat, lng };
    const map = new google.maps.Map(this.locationMapEl.nativeElement, {
      center: position,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      keyboardShortcuts: false,
      gestureHandling: 'none',
      disableDoubleClickZoom: true
    });

    new google.maps.Marker({ position, map });
  }

  private loadAnalysis(): void {
    this.loadingAnalysis.set(true);
    this.analysisError.set(false);
    this.listingService.getViabilityPreview(this.id).subscribe({
      next: (analysis) => {
        this.loadingAnalysis.set(false);
        this.analysis.set(analysis);
      },
      error: () => {
        this.loadingAnalysis.set(false);
        this.analysisError.set(true);
      }
    });
  }

  openViabilityModal(): void {
    this.viabilityRequestSent.set(false);
    const url = this.viabilityReportUrl();
    if (url) URL.revokeObjectURL(url);
    this.viabilityReportUrl.set(null);
    this.showViabilityModal.set(true);
  }

  closeViabilityModal(): void {
    if (this.submittingViabilityRequest()) return;
    this.showViabilityModal.set(false);
  }

  submitViabilityRequest(input: { name: string; email: string; phone?: string }): void {
    this.submittingViabilityRequest.set(true);
    this.listingService.requestViabilityReport(this.id, input).subscribe({
      next: (pdf) => {
        this.submittingViabilityRequest.set(false);
        this.viabilityRequestSent.set(true);
        this.viabilityReportUrl.set(URL.createObjectURL(pdf));
      },
      error: () => {
        this.submittingViabilityRequest.set(false);
        this.notification.error('listingDetail.viabilityRequestError');
      }
    });
  }
}
