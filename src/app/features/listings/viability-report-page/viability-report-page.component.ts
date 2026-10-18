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
  private map?: google.maps.Map;
  // Distinct color per traffic-generator category so the map legend/markers read at a glance —
  // Escuela/Centro comercial/Hospital/Parada de autobús/Central de autobuses.
  private static readonly CATEGORY_MARKER_COLORS: Record<string, string> = {
    Escuela: 'blue',
    'Centro comercial': 'purple',
    Hospital: 'red',
    'Parada de autobús': 'green',
    'Central de autobuses': 'green'
  };

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
    // Unlike listing-detail's own static/no-gesture preview map, this one is meant to be explored
    // — it's plotting several points (traffic generators, nearby roads) that can fall outside a
    // fixed zoom-15 view, so panning/zooming has to work.
    this.map = new google.maps.Map(this.locationMapEl.nativeElement, {
      center: position,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    new google.maps.Marker({
      position,
      map: this.map,
      title: this.translation.t('viabilityPage.mapListingMarker'),
      zIndex: 999
    });

    this.plotAnalysisMarkers();
  }

  // Called after both the map and the analysis are ready, in whichever order they resolve
  // (independent async operations — a slow Overpass/DENUE round-trip can finish well after the
  // map itself has rendered, or vice versa) — a no-op until both are present.
  private plotAnalysisMarkers(): void {
    const map = this.map;
    const analysis = this.analysis();
    if (!map || !analysis) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: analysis.lat, lng: analysis.lng });

    for (const generator of analysis.trafficGenerators) {
      const position = { lat: generator.lat, lng: generator.lng };
      new google.maps.Marker({
        position,
        map,
        title: `${generator.name} (${generator.category})`,
        icon: `https://maps.google.com/mapfiles/ms/icons/${ViabilityReportPageComponent.CATEGORY_MARKER_COLORS[generator.category] ?? 'yellow'}-dot.png`
      });
      bounds.extend(position);
    }

    for (const road of analysis.nearbyRoads) {
      const position = { lat: road.lat, lng: road.lng };
      new google.maps.Marker({
        position,
        map,
        title: road.name ?? road.classification,
        icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
      });
      bounds.extend(position);
    }

    if (analysis.trafficGenerators.length > 0 || analysis.nearbyRoads.length > 0) {
      map.fitBounds(bounds);
    }
  }

  private loadAnalysis(): void {
    this.loadingAnalysis.set(true);
    this.analysisError.set(false);
    this.listingService.getViabilityPreview(this.id).subscribe({
      next: (analysis) => {
        this.loadingAnalysis.set(false);
        this.analysis.set(analysis);
        this.plotAnalysisMarkers();
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
