import { Component, ElementRef, Injector, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ListingService } from '../../../core/services/listing.service';
import { SeoService } from '../../../core/services/seo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { ViabilityReportModalComponent } from '../../../shared/components/viability-report-modal/viability-report-modal.component';
import { Listing, NearbyRoad, ViabilityAnalysis, isLandOrCommercialPropertyType } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';
import { BUS_GLYPH, HOSPITAL_GLYPH, MALL_GLYPH, SCHOOL_GLYPH, createPoiIcon } from '../../../core/utils/map-icons';

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
  private readonly polylines: google.maps.Polyline[] = [];
  // Same circular-badge icon language as /map's own POI checklist layer (core/utils/map-icons),
  // not the generic colored-dot pins — one visual system for "this dot is a school/mall/..."
  // across the app. Built eagerly: createPoiIcon only returns plain data (a data: URL + literal
  // size/anchor objects), so it needs no live `google` global to construct, unlike a real
  // google.maps.Marker.
  private static readonly CATEGORY_ICONS: Record<string, google.maps.Icon> = {
    Escuela: createPoiIcon('#15803d', SCHOOL_GLYPH),
    'Centro comercial': createPoiIcon('#c2410c', MALL_GLYPH),
    Hospital: createPoiIcon('#b91c1c', HOSPITAL_GLYPH),
    'Parada de autobús': createPoiIcon('#2563eb', BUS_GLYPH),
    'Central de autobuses': createPoiIcon('#2563eb', BUS_GLYPH)
  };

  // Autopistas get a bolder, more saturated dashed line than other road classes — the user asked
  // specifically to make the highway stand out more than a plain avenue/secondary street.
  private static readonly ROAD_LINE_STYLES: Record<string, { color: string; scale: number; gap: string }> = {
    Autopista: { color: '#b91c1c', scale: 4, gap: '14px' },
    'Vía rápida': { color: '#c2410c', scale: 3.2, gap: '14px' },
    'Avenida/carretera principal': { color: '#92400e', scale: 2.6, gap: '12px' },
    'Avenida secundaria': { color: '#6b7280', scale: 2.2, gap: '12px' }
  };
  private static readonly DEFAULT_ROAD_LINE_STYLE = { color: '#6b7280', scale: 2.2, gap: '12px' };

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
        icon: ViabilityReportPageComponent.CATEGORY_ICONS[generator.category]
      });
      bounds.extend(position);
    }

    for (const road of analysis.nearbyRoads) {
      this.plotRoad(map, road, bounds);
    }

    if (analysis.trafficGenerators.length > 0 || analysis.nearbyRoads.length > 0) {
      map.fitBounds(bounds);
    }
  }

  // A road is highlighted as a dashed line along its real shape (OSM geometry) rather than a
  // single pin — a highway is a stretch to be aware of driving past the lot, not one point on a
  // map. Falls back to a plain marker for the rare element OSM returned with no geometry.
  private plotRoad(map: google.maps.Map, road: NearbyRoad, bounds: google.maps.LatLngBounds): void {
    if (road.geometry.length < 2) {
      new google.maps.Marker({ position: { lat: road.lat, lng: road.lng }, map, title: road.name ?? road.classification });
      bounds.extend({ lat: road.lat, lng: road.lng });
      return;
    }

    const style = ViabilityReportPageComponent.ROAD_LINE_STYLES[road.classification] ?? ViabilityReportPageComponent.DEFAULT_ROAD_LINE_STYLE;
    const path = road.geometry.map((p) => ({ lat: p.lat, lng: p.lng }));

    // The classic Maps JS dashed-line recipe: a fully transparent solid stroke (required for the
    // line to exist/be clickable at all) plus a short line symbol repeated along it.
    const polyline = new google.maps.Polyline({
      path,
      map,
      strokeOpacity: 0,
      icons: [
        {
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: style.color, strokeWeight: 2, scale: style.scale },
          offset: '0',
          repeat: style.gap
        }
      ]
    });
    this.polylines.push(polyline);

    for (const point of path) bounds.extend(point);
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
