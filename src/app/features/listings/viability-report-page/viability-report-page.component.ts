import { Component, DestroyRef, ElementRef, Injector, ViewChild, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveToast } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ListingService } from '../../../core/services/listing.service';
import { SeoService } from '../../../core/services/seo.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { BusinessViability, Listing, NearbyRoad, ViabilityAnalysis, ViabilityCheck, isLandOrCommercialPropertyType } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';
import { SwipeNavigator } from '../../../shared/utils/swipe-navigation';
import { BUS_GLYPH, GAS_STATION_GLYPH, HOSPITAL_GLYPH, MALL_GLYPH, SCHOOL_GLYPH, createPoiIcon } from '../../../core/utils/map-icons';

// The full "Reporte de Viabilidad Comercial" — every business type, every check, not just the
// top-3 teaser shown inline on listing-detail (see its viability-section, which links here).
// Its own route/page rather than a modal or an expandable section: this is meant to be a
// shareable, linkable destination in its own right (the lead magnet's actual landing page), not
// just a detail-page accordion.
@Component({
  selector: 'app-viability-report-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe],
  templateUrl: './viability-report-page.component.html',
  styleUrl: './viability-report-page.component.css'
})
export class ViabilityReportPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly listingService = inject(ListingService);
  private readonly auth = inject(AuthService);
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
    'Central de autobuses': createPoiIcon('#2563eb', BUS_GLYPH),
    Gasolinera: createPoiIcon('#ca8a04', GAS_STATION_GLYPH)
  };

  // Autopistas get a bolder, more saturated dashed line than other road classes — the user asked
  // specifically to make the highway stand out more than a plain avenue/secondary street.
  // scale stretches the dash segment itself (its length along the road); weight is the line's
  // actual thickness — both raised across the board so every road reads as a bold dashed line,
  // not a thin one, with autopista still the boldest of the set.
  private static readonly ROAD_LINE_STYLES: Record<string, { color: string; scale: number; weight: number; gap: string }> = {
    Autopista: { color: '#7f1d1d', scale: 5, weight: 5, gap: '14px' },
    'Vía rápida': { color: '#c2410c', scale: 4.2, weight: 4, gap: '14px' },
    'Avenida/carretera principal': { color: '#dc2626', scale: 3.6, weight: 4, gap: '12px' },
    'Avenida secundaria': { color: '#16a34a', scale: 3.6, weight: 4, gap: '12px' }
  };
  private static readonly DEFAULT_ROAD_LINE_STYLE = { color: '#6b7280', scale: 3, weight: 3, gap: '12px' };

  // The map legend — same marker icons/line styles used to actually plot things above, read
  // directly off those definitions so the legend can never drift out of sync with what's drawn.
  protected readonly markerLegend = [
    { icon: ViabilityReportPageComponent.CATEGORY_ICONS['Escuela'].url, labelKey: 'viabilityPage.legendSchool' },
    { icon: ViabilityReportPageComponent.CATEGORY_ICONS['Centro comercial'].url, labelKey: 'viabilityPage.legendMall' },
    { icon: ViabilityReportPageComponent.CATEGORY_ICONS['Hospital'].url, labelKey: 'viabilityPage.legendHospital' },
    { icon: ViabilityReportPageComponent.CATEGORY_ICONS['Parada de autobús'].url, labelKey: 'viabilityPage.legendTransit' },
    { icon: ViabilityReportPageComponent.CATEGORY_ICONS['Gasolinera'].url, labelKey: 'viabilityPage.legendGasStation' }
  ];
  protected readonly roadLegend = [
    { color: ViabilityReportPageComponent.ROAD_LINE_STYLES['Autopista'].color, labelKey: 'viabilityPage.legendHighway' },
    { color: ViabilityReportPageComponent.ROAD_LINE_STYLES['Vía rápida'].color, labelKey: 'viabilityPage.legendExpressway' },
    { color: ViabilityReportPageComponent.ROAD_LINE_STYLES['Avenida/carretera principal'].color, labelKey: 'viabilityPage.legendPrimaryAvenue' },
    { color: ViabilityReportPageComponent.ROAD_LINE_STYLES['Avenida secundaria'].color, labelKey: 'viabilityPage.legendSecondaryAvenue' }
  ];

  // Mirrors TrafficCongestionLevel's own numeric order on the backend (Low/Moderate/High = 0/1/2).
  private static readonly TRAFFIC_LEVEL_KEYS = ['viabilityPage.trafficLow', 'viabilityPage.trafficModerate', 'viabilityPage.trafficHigh'] as const;

  protected trafficLevelLabelKey(level: 0 | 1 | 2 | null): string | null {
    return level === null ? null : ViabilityReportPageComponent.TRAFFIC_LEVEL_KEYS[level];
  }

  // Backend sends the raw .ToString() enum name (see NearbyInfrastructureProjectDto) — mapped to
  // a Spanish label here rather than through the translate pipe, same as TrafficGenerator's own
  // `category` field (e.g. "Centro comercial"), which the backend already sends pre-labeled.
  private static readonly INFRASTRUCTURE_PROJECT_TYPE_LABELS: Record<string, string> = {
    HighwayExpansion: 'Ampliación de carretera',
    NewRoad: 'Nueva vialidad',
    IndustrialPark: 'Parque industrial',
    PublicTransit: 'Transporte público',
    Hospital: 'Hospital',
    School: 'Escuela',
    Other: 'Otro'
  };
  private static readonly INFRASTRUCTURE_PROJECT_STATUS_LABELS: Record<string, string> = {
    Announced: 'Anunciado',
    InProgress: 'En construcción',
    Completed: 'Completado',
    Cancelled: 'Cancelado'
  };

  // Per-giro, not global: the same attribute (e.g. low traffic) can be a strength for one business
  // type and a weakness for another, so a single site-wide "strengths" summary would show
  // contradictory claims side by side. Scoped to each business card instead, reusing checks the
  // report already computed — no new data, just which of them happened to pass for this giro.
  // Backs the card's "Criterios Cumplidos" section.
  protected strengths(business: BusinessViability): ViabilityCheck[] {
    return business.checks.filter((c) => c.passed === true);
  }

  // Backs the card's "Faltantes / Pendientes" section. Only real, giro-specific failures
  // (passed === false) — a check the backend couldn't evaluate at all (passed === null, e.g. no
  // frontage reported) isn't a failure of THIS giro, it's a gap in the lot's own data, so it's
  // pulled out of every card and shown once in missingDataNotices() instead of repeated 20+ times.
  protected pendingChecks(business: BusinessViability): ViabilityCheck[] {
    return business.checks.filter((c) => c.passed === false);
  }

  // One line for the card header: the cap reason if a hard-blocker capped the score
  // (the strongest possible "why"), else the first real failure, else the first thing working in
  // its favor — whichever exists first is the most informative single line available for this giro.
  protected primaryReason(business: BusinessViability): string {
    if (business.scoreCapReason) return business.scoreCapReason;
    const failed = business.checks.find((c) => c.passed === false);
    if (failed) return failed.detail;
    const passed = business.checks.find((c) => c.passed === true);
    if (passed) return passed.detail;
    // A lot this sparse on data (every check for this giro landed as "no se pudo evaluar") has
    // nothing to show in either direction — say so explicitly rather than leaving the reason
    // line blank, which would read as a rendering bug rather than a genuine lack of data.
    return this.translation.t('viabilityPage.noDataForBusiness');
  }

  // Deduped across every giro — the same lot-level gap (e.g. "no se reportó si está en esquina")
  // shows up identically in most businesses' checks, so collecting it once here instead of
  // rendering it inside each card avoids saying the same thing 20+ times on one page.
  readonly missingDataNotices = computed(() => {
    const messages = new Set<string>();
    for (const business of this.rankedBusinesses()) {
      for (const check of business.checks) {
        if (check.passed === null) messages.add(check.detail);
      }
    }
    return [...messages];
  });

  // Gallery-style: one giro visible at a time (like a single photo in listing-detail's own main
  // gallery), navigated with prev/next arrows, a thumbnail strip, swipe, or trackpad scroll — see
  // showBusiness()/nextBusiness()/previousBusiness() below, which mirror that gallery's
  // changePhoto()/nextPhoto()/previousPhoto() shape.
  readonly activeBusinessIndex = signal(0);
  readonly activeBusiness = computed(() => this.rankedBusinesses()[this.activeBusinessIndex()] ?? null);

  protected showBusiness(index: number): void {
    if (index === this.activeBusinessIndex()) return;
    this.activeBusinessIndex.set(index);
  }

  protected nextBusiness(): void {
    const count = this.rankedBusinesses().length;
    if (count < 2) return;
    this.showBusiness((this.activeBusinessIndex() + 1) % count);
  }

  protected previousBusiness(): void {
    const count = this.rankedBusinesses().length;
    if (count < 2) return;
    this.showBusiness((this.activeBusinessIndex() - 1 + count) % count);
  }

  // Same gesture logic as listing-detail's photo gallery (onPhotoWheel/onPhotoTouchStart/
  // onPhotoTouchEnd) — shared via SwipeNavigator now that it has a second use, rather than a
  // second hand-written copy of the same thresholds/debounce.
  protected readonly businessSwipe = new SwipeNavigator(
    () => this.nextBusiness(),
    () => this.previousBusiness()
  );

  protected infrastructureProjectTypeLabel(type: string): string {
    return ViabilityReportPageComponent.INFRASTRUCTURE_PROJECT_TYPE_LABELS[type] ?? type;
  }

  protected infrastructureProjectStatusLabel(status: string): string {
    return ViabilityReportPageComponent.INFRASTRUCTURE_PROJECT_STATUS_LABELS[status] ?? status;
  }

  // Mutable, not readonly: Angular's default RouteReuseStrategy reuses this component instance
  // across navigations between two URLs matching this same route config (e.g. one listing's
  // report to another's), so the id has to track route.paramMap rather than being read once from
  // the snapshot — otherwise a client-side navigation between two reports would keep showing the
  // first listing's data with no refetch.
  private id = '';
  private lastLoadedId: string | null = null;

  readonly listing = signal<Listing | null>(null);
  readonly loading = signal(true);
  readonly notEligible = signal(false);

  readonly analysis = signal<ViabilityAnalysis | null>(null);
  readonly loadingAnalysis = signal(false);
  readonly analysisError = signal(false);

  // Worst-first would bury the point of the report; best-first lets a reader (often the business
  // actually scouting this lot, not just the seller) see the strongest fits immediately.
  readonly rankedBusinesses = computed(() => [...(this.analysis()?.businesses ?? [])].sort((a, b) => b.score - a.score));
  readonly topBusiness = computed(() => this.rankedBusinesses()[0] ?? null);

  // Gates the "complete your listing's data" CTA — this report page is public (anyone evaluating
  // the property can open it), so the prompt to go fill in missing fields only makes sense for
  // whoever can actually act on it: the listing's own owner (an Agent account that listed the
  // property IS that ownerId, there's no separate "managing agent for someone else's listing"
  // concept in this app) or an Admin.
  readonly canEditListing = computed(() => this.auth.isAdmin() || this.auth.isOwnerOf(this.listing()?.ownerId));

  private viabilityLoadingToast: ActiveToast<unknown> | null = null;

  constructor() {
    // Registered synchronously here (an active injection context) rather than inside
    // loadAnalysis(), which runs later from inside an async subscribe callback where inject()
    // would throw — a safety net dismissing the loading toast if the visitor navigates away
    // mid-request, on top of the two branches in loadAnalysis() that already dismiss it.
    inject(DestroyRef).onDestroy(() => this.dismissViabilityLoadingToast());

    // paramMap (not the snapshot) so a reused instance re-fetches when only the :id changes; it
    // replays the current params on subscribe, so this also drives the very first load.
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

    this.listingService.fetchById(id).subscribe({
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

  // Clears every piece of per-listing state before fetching the next id, so a reused instance
  // (see loadListing) never shows a stale mix of the previous listing's data while the new one
  // is loading — the old map's markers/polylines disappear too, since initLocationMap replaces
  // the map div's content outright.
  private resetForNewListing(): void {
    this.dismissViabilityLoadingToast();
    this.listing.set(null);
    this.loading.set(true);
    this.notEligible.set(false);
    this.analysis.set(null);
    this.loadingAnalysis.set(false);
    this.analysisError.set(false);
    this.activeBusinessIndex.set(0);

    for (const polyline of this.polylines) polyline.setMap(null);
    this.polylines.length = 0;
    this.map = undefined;
  }

  private async initLocationMap(lat: number, lng: number): Promise<void> {
    if (!this.locationMapEl) return;

    await loadGoogleMaps();

    const position = { lat, lng };
    // Unlike listing-detail's own static/no-gesture preview map, this one is meant to be explored
    // — it's plotting several points (traffic generators, nearby roads) that can fall outside a
    // tight zoom, so panning/zooming has to work. Starts a bit further out than that detail map's
    // own zoom 15 so there's visible context around the lot even before fitBounds runs.
    this.map = new google.maps.Map(this.locationMapEl.nativeElement, {
      center: position,
      zoom: 13,
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
      // Padding so the outermost markers/road points aren't flush against the map edge, and a
      // one-time zoom cap after fitBounds settles — fitBounds can zoom in quite tight when every
      // point happens to sit close together, which reads as "too close" rather than "a bit
      // further out" as asked.
      map.fitBounds(bounds, 32);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
      });
    } else {
      map.setZoom(13);
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
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: style.color, strokeWeight: style.weight, scale: style.scale },
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

    // The inline "cargando análisis" state sits well down the page (past the KPI row, fact
    // sheet, and map card) — easy to miss without scrolling. This toast mirrors that same loading
    // state but renders on top of the whole page. Dismissed in both branches below, never left up
    // past the request finishing either way.
    this.viabilityLoadingToast = this.notification.loading('listingDetail.viabilityLoading');

    this.listingService.getViabilityPreview(this.id).subscribe({
      next: (analysis) => {
        this.loadingAnalysis.set(false);
        this.analysis.set(analysis);
        this.plotAnalysisMarkers();
        this.dismissViabilityLoadingToast();
      },
      error: () => {
        this.loadingAnalysis.set(false);
        this.analysisError.set(true);
        this.dismissViabilityLoadingToast();
        this.notification.error('listingDetail.viabilityError');
      }
    });
  }

  private dismissViabilityLoadingToast(): void {
    if (!this.viabilityLoadingToast) return;
    this.notification.dismiss(this.viabilityLoadingToast);
    this.viabilityLoadingToast = null;
  }

  // Direct, ungated download — a plain GET the browser can navigate to on its own, same pattern
  // as listing-detail's qrCodeUrl for the fact-sheet PDF. No Observable/blob juggling needed
  // here since there's no request body to send (unlike the old lead-capture POST flow this
  // button replaces).
  downloadViabilityReportPdf(): void {
    window.open(`${environment.apiUrl}/listings/${this.id}/viability-report-pdf`, '_blank');
  }
}
