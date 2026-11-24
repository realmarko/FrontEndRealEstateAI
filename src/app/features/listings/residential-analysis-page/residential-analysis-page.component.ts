import { Component, DestroyRef, ElementRef, Injector, ViewChild, afterNextRender, inject, signal } from '@angular/core';
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
import { Listing, NearbyRoad, ResidentialAnalysis, isHouseOrApartmentPropertyType } from '../../../core/models/listing.model';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';
import { GYM_GLYPH, HOSPITAL_GLYPH, PARK_GLYPH, PHARMACY_GLYPH, SCHOOL_GLYPH, SHOPPING_CART_GLYPH, createPoiIcon } from '../../../core/utils/map-icons';

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
  private readonly injector = inject(Injector);
  protected readonly translation = inject(TranslationService);

  @ViewChild('locationMap') private locationMapEl?: ElementRef<HTMLDivElement>;
  private map?: google.maps.Map;
  private readonly polylines: google.maps.Polyline[] = [];
  // Same circular-badge icon language as /map's own POI checklist layer and the viability
  // report's own map (core/utils/map-icons) — one visual system for "this dot is a
  // school/pharmacy/..." across the app. Keys match ResidentialAnalysisService's own
  // AmenitySearches categories on the backend exactly.
  private static readonly CATEGORY_ICONS: Record<string, google.maps.Icon> = {
    Escuela: createPoiIcon('#15803d', SCHOOL_GLYPH),
    Supermercado: createPoiIcon('#9333ea', SHOPPING_CART_GLYPH),
    Farmacia: createPoiIcon('#be123c', PHARMACY_GLYPH),
    Hospital: createPoiIcon('#b91c1c', HOSPITAL_GLYPH),
    Parque: createPoiIcon('#0d9488', PARK_GLYPH),
    Gimnasio: createPoiIcon('#2563eb', GYM_GLYPH)
  };

  // Same road-line styling as the viability report's own ROAD_LINE_STYLES — one visual language
  // for "this line is a highway/avenue" across both reports.
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
    { icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS['Escuela'].url, labelKey: 'residentialAnalysisPage.legendSchool' },
    { icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS['Supermercado'].url, labelKey: 'residentialAnalysisPage.legendSupermarket' },
    { icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS['Farmacia'].url, labelKey: 'residentialAnalysisPage.legendPharmacy' },
    { icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS['Hospital'].url, labelKey: 'residentialAnalysisPage.legendHospital' },
    { icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS['Parque'].url, labelKey: 'residentialAnalysisPage.legendPark' },
    { icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS['Gimnasio'].url, labelKey: 'residentialAnalysisPage.legendGym' }
  ];
  protected readonly roadLegend = [
    { color: ResidentialAnalysisPageComponent.ROAD_LINE_STYLES['Autopista'].color, labelKey: 'residentialAnalysisPage.legendHighway' },
    { color: ResidentialAnalysisPageComponent.ROAD_LINE_STYLES['Vía rápida'].color, labelKey: 'residentialAnalysisPage.legendExpressway' },
    { color: ResidentialAnalysisPageComponent.ROAD_LINE_STYLES['Avenida/carretera principal'].color, labelKey: 'residentialAnalysisPage.legendPrimaryAvenue' },
    { color: ResidentialAnalysisPageComponent.ROAD_LINE_STYLES['Avenida secundaria'].color, labelKey: 'residentialAnalysisPage.legendSecondaryAvenue' }
  ];

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

        if (listing.lat != null && listing.lng != null) {
          const lat = listing.lat;
          const lng = listing.lng;
          // Same reasoning as the viability report's own initLocationMap: the map container only
          // exists once this @else branch renders, and afterNextRender guarantees that render has
          // already happened before the ViewChild is read.
          afterNextRender(() => this.initLocationMap(lat, lng), { injector: this.injector });
        }
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

    for (const polyline of this.polylines) polyline.setMap(null);
    this.polylines.length = 0;
    this.map = undefined;
  }

  private async initLocationMap(lat: number, lng: number): Promise<void> {
    if (!this.locationMapEl) return;

    await loadGoogleMaps();

    const position = { lat, lng };
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
      title: this.translation.t('residentialAnalysisPage.mapListingMarker'),
      zIndex: 999
    });

    this.plotAnalysisMarkers();
  }

  // Called after both the map and the analysis are ready, in whichever order they resolve
  // (independent async operations — a slow DENUE/Overpass round-trip can finish well after the
  // map itself has rendered, or vice versa) — a no-op until both are present.
  private plotAnalysisMarkers(): void {
    const map = this.map;
    const analysis = this.analysis();
    if (!map || !analysis) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: analysis.lat, lng: analysis.lng });

    for (const amenity of analysis.nearbyAmenities) {
      const position = { lat: amenity.lat, lng: amenity.lng };
      new google.maps.Marker({
        position,
        map,
        title: `${amenity.name} (${amenity.category})`,
        icon: ResidentialAnalysisPageComponent.CATEGORY_ICONS[amenity.category]
      });
      bounds.extend(position);
    }

    for (const road of analysis.nearbyRoads) {
      this.plotRoad(map, road, bounds);
    }

    if (analysis.nearbyAmenities.length > 0 || analysis.nearbyRoads.length > 0) {
      // Same padding/zoom-cap reasoning as the viability report's own plotAnalysisMarkers:
      // fitBounds can zoom in quite tight when every point happens to sit close together.
      map.fitBounds(bounds, 32);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
      });
    }
  }

  // Same dashed-line-along-the-real-shape approach as the viability report's own plotRoad — a
  // road is a stretch to be aware of near the lot, not one point on a map. Falls back to a plain
  // marker for the rare element OSM returned with no geometry.
  private plotRoad(map: google.maps.Map, road: NearbyRoad, bounds: google.maps.LatLngBounds): void {
    if (road.geometry.length < 2) {
      new google.maps.Marker({ position: { lat: road.lat, lng: road.lng }, map, title: road.name ?? road.classification });
      bounds.extend({ lat: road.lat, lng: road.lng });
      return;
    }

    const style = ResidentialAnalysisPageComponent.ROAD_LINE_STYLES[road.classification] ?? ResidentialAnalysisPageComponent.DEFAULT_ROAD_LINE_STYLE;
    const path = road.geometry.map((p) => ({ lat: p.lat, lng: p.lng }));

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
        this.plotAnalysisMarkers();
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
