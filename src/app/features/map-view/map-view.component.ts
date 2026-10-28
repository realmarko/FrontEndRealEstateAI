import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, Signal, ViewChild, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { ActiveToast } from 'ngx-toastr';
import { MarkerClusterer, Renderer } from '@googlemaps/markerclusterer';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ListingService } from '../../core/services/listing.service';
import { BrokerageService } from '../../core/services/brokerage.service';
import { toSlug } from '../../core/services/brokerage-api.adapter';
import { AgencyMapItem } from '../../core/models/agency.model';
import { SavedSearchService } from '../../core/services/saved-search.service';
import {
  AgebBoundary,
  AgebCompetitorDensity,
  GeoJsonGeometry,
  GeomarketingService,
  MunicipalityListItem,
  PopulationDensity,
  SocioeconomicLevel
} from '../../core/services/geomarketing.service';
import { NotificationService } from '../../core/services/notification.service';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { ComparisonService } from '../../core/services/comparison.service';
import { SeoService } from '../../core/services/seo.service';
import { ListingCardComponent } from '../listings/components/listing-card.component';
import { CmaResult, DEFAULT_LISTING_IMAGE, Listing, ListingType, PROPERTY_TYPE_FILTER_OPTIONS, PropertyType } from '../../core/models/listing.model';
import { FraccionamientoService } from '../../core/services/fraccionamiento.service';
import {
  BANK_GLYPH,
  BUS_GLYPH,
  CHILDCARE_GLYPH,
  CONVENIENCE_STORE_GLYPH,
  GAS_STATION_GLYPH,
  GYM_GLYPH,
  HOSPITAL_GLYPH,
  MALL_GLYPH,
  PARK_GLYPH,
  PHARMACY_GLYPH,
  SCHOOL_GLYPH,
  SHOPPING_CART_GLYPH,
  SPORTS_CENTER_GLYPH,
  createPoiIcon
} from '../../core/utils/map-icons';
import { FraccionamientoPublicListItem } from '../../core/models/fraccionamiento.model';
import { applyCurrencyMask } from '../../shared/utils/currency-input';
import { normalizeText } from '../../shared/utils/normalize-text';
import { parseCoordinates } from '../../shared/utils/parse-coordinates';
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_INTEREST_RATE_PERCENT,
  DEFAULT_TERM_YEARS,
  calculateMonthlyPayment
} from '../../shared/utils/mortgage';

const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 19.0414, lng: -98.2063 }; // Puebla, MX
const DEFAULT_ZOOM = 16;
const GOOGLE_LOAD_POLL_MS = 100;

// Bounds how long the initial load waits on the "latest listing" fetch before giving up and
// opening at DEFAULT_CENTER instead — without this, a slow/unresponsive backend would leave the
// map stuck on its loading overlay indefinitely (the old geolocation-based approach this
// replaced had the same kind of bound for the same reason).
const INITIAL_CENTER_TIMEOUT_MS = 5000;
const MY_LISTING_ICON = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
// Yellow is otherwise unused by MY_LISTING_ICON or any POI_CATEGORIES color below, and reads as
// "featured/special" — fitting for a whole development rather than a single unit.
const FRACCIONAMIENTO_ICON = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
const FRACCIONAMIENTO_CLUSTER_COLOR = '#c6a15b';
// Purple is otherwise unused — a brokerage office is a different kind of pin from both a listing
// and a fraccionamiento, so it gets its own unmistakable color.
const BROKERAGE_ICON = 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png';
const BROKERAGE_CLUSTER_COLOR = '#7c3aed';
// Published developments are still few in number at this stage — one fetch covers the realistic
// total without needing map-bounds-driven pagination like listings use. Capped at 100, matching
// GET /api/fraccionamientos/published's own Math.Clamp(pageSize, 1, 100) ceiling — asking for
// more than that wouldn't get more back, just silently look like it did.
const FRACCIONAMIENTOS_MAP_PAGE_SIZE = 100;

// The clustering algorithm's default maxZoom (16) stops clustering well before this app's own
// default zoom (16-18, street level) — raised so nearby markers still group up there too.
const CLUSTER_ALGORITHM_OPTIONS = { maxZoom: 20 };

export type PoiCategoryKey =
  | 'schools'
  | 'daycare'
  | 'pharmacies'
  | 'gyms'
  | 'hospitals'
  | 'sportsCenters'
  | 'malls'
  | 'oxxo'
  | 'parks'
  | 'walmart'
  | 'chedraui'
  | 'aurrera'
  | 'tiendas3b'
  | 'banks'
  | 'gasStations'
  | 'transitStops';

// The POI checklist panel renders categories under these section headers instead of one flat
// list — order here is the order the groups render in.
export type PoiGroupKey = 'education' | 'health' | 'services' | 'transport';

export const POI_GROUPS: { key: PoiGroupKey; labelKey: string }[] = [
  { key: 'education', labelKey: 'map.poiGroupEducation' },
  { key: 'health', labelKey: 'map.poiGroupHealth' },
  { key: 'services', labelKey: 'map.poiGroupServices' },
  { key: 'transport', labelKey: 'map.poiGroupTransport' }
];

interface PoiCategoryConfig {
  key: PoiCategoryKey;
  group: PoiGroupKey;
  labelKey: string;
  // Google Places "type" filter — see https://developers.google.com/maps/documentation/places/web-service/supported_types
  placeType: string;
  // Narrows results within placeType to a specific name match — Places has no dedicated "type"
  // for a single chain like OXXO, so 'convenience_store' + this keyword is how that's filtered
  // down to just OXXO locations instead of every convenience store in view.
  keyword?: string;
  icon: google.maps.Icon;
  clusterColor: string;
}


// One entry per checklist item on the map page. Each category gets its own marker color and
// cluster color so overlapping categories (e.g. schools + parks) stay visually distinguishable.
const POI_CATEGORIES: PoiCategoryConfig[] = [
  {
    key: 'schools',
    group: 'education',
    labelKey: 'map.poiSchools',
    placeType: 'school',
    icon: createPoiIcon('#15803d', SCHOOL_GLYPH),
    clusterColor: '#15803d'
  },
  {
    key: 'daycare',
    group: 'education',
    labelKey: 'map.poiDaycare',
    // Places has no dedicated "daycare" type — most guarderías are tagged 'school', so the
    // keyword narrows that down the same way OXXO narrows 'convenience_store'.
    placeType: 'school',
    keyword: 'guardería',
    icon: createPoiIcon('#db2777', CHILDCARE_GLYPH),
    clusterColor: '#db2777'
  },
  {
    key: 'pharmacies',
    group: 'health',
    labelKey: 'map.poiPharmacies',
    placeType: 'pharmacy',
    // A shade apart from oxxo's red (#dc2626) so the two stay distinguishable when both layers
    // are active at once, rather than sharing one pixel-identical red.
    icon: createPoiIcon('#b91c1c', PHARMACY_GLYPH),
    clusterColor: '#b91c1c'
  },
  {
    key: 'gyms',
    group: 'health',
    labelKey: 'map.poiGyms',
    placeType: 'gym',
    icon: createPoiIcon('#2563eb', GYM_GLYPH),
    clusterColor: '#2563eb'
  },
  {
    key: 'hospitals',
    group: 'health',
    labelKey: 'map.poiHospitals',
    placeType: 'hospital',
    // A shade apart from pharmacies' red (#b91c1c) and oxxo's (#dc2626).
    icon: createPoiIcon('#be123c', HOSPITAL_GLYPH),
    clusterColor: '#be123c'
  },
  {
    key: 'sportsCenters',
    group: 'health',
    labelKey: 'map.poiSportsCenters',
    // Places has no "sports complex" type of its own — narrows 'gym' results to ones actually
    // named as a club/centro deportivo instead of a plain gym (already its own category above).
    placeType: 'gym',
    keyword: 'deportivo',
    icon: createPoiIcon('#0891b2', SPORTS_CENTER_GLYPH),
    clusterColor: '#0891b2'
  },
  {
    key: 'malls',
    group: 'services',
    labelKey: 'map.poiMalls',
    placeType: 'shopping_mall',
    icon: createPoiIcon('#c2410c', MALL_GLYPH),
    clusterColor: '#c2410c'
  },
  {
    key: 'oxxo',
    group: 'services',
    labelKey: 'map.poiOxxo',
    placeType: 'convenience_store',
    keyword: 'OXXO',
    icon: createPoiIcon('#dc2626', CONVENIENCE_STORE_GLYPH),
    clusterColor: '#dc2626'
  },
  {
    key: 'parks',
    group: 'services',
    labelKey: 'map.poiParks',
    placeType: 'park',
    // A shade apart from schools' green (#15803d) so the two stay distinguishable when both
    // layers are active at once, rather than sharing one pixel-identical green.
    icon: createPoiIcon('#16a34a', PARK_GLYPH),
    clusterColor: '#16a34a'
  },
  {
    key: 'walmart',
    group: 'services',
    labelKey: 'map.poiWalmart',
    // Reuses the same generic shopping-cart glyph as the other grocery chains below — they're
    // told apart by badge color, not by reproducing each chain's own trademarked logo.
    placeType: 'supermarket',
    keyword: 'Walmart',
    icon: createPoiIcon('#0369a1', SHOPPING_CART_GLYPH),
    clusterColor: '#0369a1'
  },
  {
    key: 'chedraui',
    group: 'services',
    labelKey: 'map.poiChedraui',
    placeType: 'supermarket',
    keyword: 'Chedraui',
    icon: createPoiIcon('#0d9488', SHOPPING_CART_GLYPH),
    clusterColor: '#0d9488'
  },
  {
    key: 'aurrera',
    group: 'services',
    labelKey: 'map.poiAurrera',
    // Covers both "Bodega Aurrera" and "Mi Bodega Aurrera" — both contain "Aurrera".
    placeType: 'supermarket',
    keyword: 'Aurrera',
    icon: createPoiIcon('#d97706', SHOPPING_CART_GLYPH),
    clusterColor: '#d97706'
  },
  {
    key: 'tiendas3b',
    group: 'services',
    labelKey: 'map.poiTiendas3b',
    placeType: 'convenience_store',
    keyword: '3B',
    icon: createPoiIcon('#9333ea', SHOPPING_CART_GLYPH),
    clusterColor: '#9333ea'
  },
  {
    key: 'banks',
    group: 'services',
    labelKey: 'map.poiBanks',
    // 'bank' is the closer single Places type for a visual landmark; most bank branches also
    // have an on-site ATM, which is what "Bancos y ATM" is after as one combined layer.
    placeType: 'bank',
    icon: createPoiIcon('#475569', BANK_GLYPH),
    clusterColor: '#475569'
  },
  {
    key: 'gasStations',
    group: 'transport',
    labelKey: 'map.poiGasStations',
    placeType: 'gas_station',
    icon: createPoiIcon('#ea580c', GAS_STATION_GLYPH),
    clusterColor: '#ea580c'
  },
  {
    key: 'transitStops',
    group: 'transport',
    labelKey: 'map.poiTransitStops',
    placeType: 'transit_station',
    icon: createPoiIcon('#4338ca', BUS_GLYPH),
    clusterColor: '#4338ca'
  }
];

interface OpportunityLevel {
  color: string;
  labelKey: string;
}

interface OpportunityAnalysisResult {
  count: number;
  level: OpportunityLevel;
  source: 'denue' | 'places';
  population: PopulationDensity | null;
}

// One i18n key per SocioeconomicLevel value the backend can send — see PopulationDensity. Keyed
// by the actual union type (like FUNDING_METHOD_KEYS/TIMELINE_KEYS in messages.component.ts) so
// adding or renaming a level without updating this map is a compile error, not a silent runtime gap.
const SOCIOECONOMIC_LEVEL_LABEL_KEYS: Record<SocioeconomicLevel, string> = {
  Bajo: 'map.socioeconomicBajo',
  MedioBajo: 'map.socioeconomicMedioBajo',
  Medio: 'map.socioeconomicMedio',
  MedioAlto: 'map.socioeconomicMedioAlto',
  Alto: 'map.socioeconomicAlto'
};

// Sequential choropleth palette (light -> dark = low -> high) for the AGEB layer — ColorBrewer's
// "Reds", chosen because none of its steps collide with any color already used elsewhere on this
// map (listing clusters navy, municipality polygon gold, POI categories green/red/orange/pink/
// blue). AGEBs with no estimate (INEGI's own data masking) fall back to a neutral grey.
const SOCIOECONOMIC_LEVEL_COLORS: Record<SocioeconomicLevel, string> = {
  Bajo: '#fee5d9',
  MedioBajo: '#fcae91',
  Medio: '#fb6a4a',
  MedioAlto: '#de2d26',
  Alto: '#a50f15'
};
const AGEB_UNSCORED_COLOR = '#9ca3af';

export type OpportunityCategoryKey = 'pharmacy' | 'gym' | 'oxxo' | 'gasStation';

interface OpportunityCategoryConfig {
  key: OpportunityCategoryKey;
  labelKey: string;
  // The plural noun used in "N {{category}} within {{radiusKm}} km" — kept separate from
  // labelKey (the radio button's own label) since "OXXO"/"gyms" read naturally in that sentence
  // but "Pharmacy" (singular, capitalized) does not.
  pluralLabelKey: string;
  // Its own Google Places "type" and marker icon — not borrowed from POI_CATEGORIES via a
  // poiKey lookup, since that coupling only existed because pharmacy happened to already be a
  // POI checklist entry. The opportunity tool and the POI checklist are separate features that
  // shouldn't have to share category definitions.
  placeType: string;
  icon: string;
  radiusMeters: number;
  // Competitor count at/below which the area still counts as "good"/"moderate" — above the
  // second threshold it's "saturated". Each category is tuned to its own typical density
  // (a convenience-store chain like OXXO clusters far tighter than pharmacies or gyms do).
  goodMaxCount: number;
  moderateMaxCount: number;
  // INEGI DENUE's search matches business name/street/colonia/economic-activity text — for OXXO
  // this matches on the chain's actual registered name rather than a generic activity term.
  denueSearchTerm: string;
}

// One entry per business type the opportunity tool can analyze, picked via the radio buttons in
// the opportunity-checklist panel (map-view.component.html). Adding another type means adding an
// entry here (plus its i18n keys and the backend's AllowedSearchTerms), not forking
// analyzeOpportunity/drawOpportunityCircle per type.
const OPPORTUNITY_CATEGORIES: OpportunityCategoryConfig[] = [
  {
    key: 'pharmacy',
    labelKey: 'map.opportunityPharmacy',
    pluralLabelKey: 'map.opportunityPharmacyPlural',
    placeType: 'pharmacy',
    icon: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
    radiusMeters: 1000,
    goodMaxCount: 2,
    moderateMaxCount: 5,
    denueSearchTerm: 'farmacia'
  },
  {
    key: 'gym',
    labelKey: 'map.opportunityGym',
    pluralLabelKey: 'map.opportunityGymPlural',
    placeType: 'gym',
    icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    radiusMeters: 1000,
    goodMaxCount: 2,
    moderateMaxCount: 4,
    denueSearchTerm: 'gimnasio'
  },
  {
    key: 'oxxo',
    labelKey: 'map.opportunityOxxo',
    pluralLabelKey: 'map.opportunityOxxoPlural',
    placeType: 'convenience_store',
    icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
    radiusMeters: 500,
    goodMaxCount: 1,
    moderateMaxCount: 3,
    denueSearchTerm: 'oxxo'
  },
  {
    key: 'gasStation',
    labelKey: 'map.opportunityGasStation',
    pluralLabelKey: 'map.opportunityGasStationPlural',
    placeType: 'gas_station',
    icon: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
    radiusMeters: 1500,
    goodMaxCount: 1,
    moderateMaxCount: 3,
    denueSearchTerm: 'gasolinera'
  }
];

// Nearby Search returns at most 20 results per page without paginating (each extra page is a
// separate billed call with a mandatory ~2s delay before Google will serve it) — for a traffic
// light this coarse, treating "20 found" the same as "37 found" (both land in the top band) is
// an acceptable approximation, so pagination isn't pursued here.
function opportunityLevel(competitorCount: number, config: OpportunityCategoryConfig): OpportunityLevel {
  if (competitorCount <= config.goodMaxCount) return { color: '#16a34a', labelKey: 'map.opportunityGood' };
  if (competitorCount <= config.moderateMaxCount) return { color: '#ca8a04', labelKey: 'map.opportunityModerate' };
  return { color: '#dc2626', labelKey: 'map.opportunitySaturated' };
}

// The library's default renderer colors every cluster plain blue (red once it's unusually
// large) regardless of what it's clustering — which would collide with this page's own
// blue/red "My listings"/"Other listings" legend and give a school cluster the same blue as
// "mine". A fixed color per marker type keeps a cluster's color as meaningful as the pins it's standing in for.
function createClusterRenderer(color: string): Renderer {
  return {
    render({ count, position }) {
      const svg =
        `<svg fill="${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="50" height="50">` +
        `<circle cx="120" cy="120" opacity=".6" r="70" />` +
        `<circle cx="120" cy="120" opacity=".3" r="90" />` +
        `<circle cx="120" cy="120" opacity=".2" r="110" />` +
        `<text x="50%" y="50%" style="fill:#fff" text-anchor="middle" font-size="50" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${count}</text>` +
        `</svg>`;

      return new google.maps.Marker({
        position,
        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
        title: `Cluster of ${count} markers`,
        icon: {
          url: `data:image/svg+xml;base64,${btoa(svg)}`,
          anchor: new google.maps.Point(25, 25)
        }
      });
    }
  };
}

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ListingCardComponent],
  templateUrl: './map-view.component.html',
  // Split across two files so each stays under the production build's per-stylesheet budget
  // (angular.json's "anyComponentStyle" — see map-view-mobile.component.css's own header
  // comment): the mobile-only chrome (compact search bar, map/list tabs, full-screen filters
  // page) is substantial enough on its own that combined with the desktop styles it pushed a
  // single file over the 8kB error ceiling.
  styleUrls: ['./map-view.component.css', './map-view-mobile.component.css']
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('locateBtn', { static: true }) private readonly locateBtnEl!: ElementRef<HTMLButtonElement>;

  hasError = false;
  addMode = false;
  // Admin-only counterpart to addMode — see toggleAddBrokerageMode. Mutually exclusive with
  // every other click-driven tool on this page, same reasoning as addMode/opportunityMode.
  addBrokerageMode = false;
  locatingMe = false;
  // False until buildMap() runs once on initial load — drives the loading overlay so the visitor
  // sees "loading map…" instead of a blank container while resolveInitialCenter is still working.
  mapReady = false;
  // Drives hiding the toolbar (add-property, POI/opportunity pickers, legend) while Street View
  // fills the map pane — those controls interpret map clicks (placing a marker, analyzing
  // opportunity) that don't make sense once the view isn't looking down at the map anymore.
  readonly streetViewActive = signal(false);
  selectedLat: number | null = null;
  selectedLng: number | null = null;

  // True only while the drawing tool is armed and waiting for the visitor to trace a shape —
  // mirrors addMode/opportunityMode's own plain-boolean convention (template-bound via
  // [class.active], always flipped from inside a zone-run click handler).
  freehandMode = false;
  // The completed freehand shape, once drawn — read by visibleListings to scope results to its
  // interior instead of the map's rectangular viewport. Null whenever no shape is active.
  readonly freehandShape = signal<google.maps.Polygon | null>(null);

  opportunityMode = false;
  readonly opportunityResult = signal<OpportunityAnalysisResult | null>(null);
  // Tracks the "analyzing…" toast shown by analyzeOpportunity (see also clearOpportunityOverlay)
  // so it can be dismissed on every exit path, same contract as
  // NotificationService.loading's own doc comment.
  private opportunityLoadingToast: ActiveToast<unknown> | null = null;

  // CMA (comparative market analysis) over the active freehand shape — see openCma below. Null
  // whenever the results panel isn't open.
  readonly loadingCma = signal(false);
  readonly cmaResult = signal<CmaResult | null>(null);
  readonly opportunityCategories = OPPORTUNITY_CATEGORIES;
  readonly showOpportunityChecklist = signal(false);
  // null until the user picks one from the radio buttons — there's no sensible default business
  // type to start "in analyze mode" for before they've chosen one.
  readonly selectedOpportunityCategory = signal<OpportunityCategoryKey | null>(null);

  readonly poiCategories = POI_CATEGORIES;
  readonly poiGroups = POI_GROUPS;
  readonly showPoiChecklist = signal(false);
  readonly checkedPoiCategories = signal<Set<PoiCategoryKey>>(new Set());
  readonly loadingPoiCategories = signal<Set<PoiCategoryKey>>(new Set());

  // Mobile bottom-sheet-only behavior: dragging a finger down on a panel collapses it to just its
  // header (more map visible underneath), dragging up restores it. Shared by both panels since
  // only one is ever open at a time. Desktop ignores this (its sheets are small anchored
  // dropdowns, not a bottom sheet eating screen space), but the signal is harmless there too.
  readonly sheetCollapsed = signal(false);

  readonly search = signal('');
  readonly typeFilter = signal<ListingType | 'all'>('sale');
  readonly propertyTypeFilter = signal<PropertyType | 'all'>('all');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minBeds = signal<number | 'any'>('any');
  readonly minBaths = signal<number | 'any'>('any');
  readonly showMoreFilters = signal(false);
  readonly propertyTypeOptions = PROPERTY_TYPE_FILTER_OPTIONS;
  readonly companyFilter = signal('');
  readonly brokerages = signal<string[]>([]);
  // Root-scoped GeomarketingService fetches this once for the whole app — assigned in the
  // constructor body (not as a field initializer) because geomarketingService is itself a
  // constructor-injected parameter property: a field initializer referencing it here would run
  // before that assignment happens and read undefined.
  readonly municipalities: Signal<MunicipalityListItem[]>;
  // Empty string = no municipality filter applied (the "todos" option) — not null, so it binds
  // directly to a <select>'s value like every other filter here.
  readonly municipalityFilter = signal('');
  // The live polygon drawn on the map for the selected municipality — read inside
  // filteredListings below via google.maps.geometry.poly.containsLocation. Null exactly when
  // municipalityFilter() is '' (see selectMunicipality).
  private readonly municipalityPolygon = signal<google.maps.Polygon | null>(null);

  // Separate from the dropdown above: set when the main search box's own text exactly matches a
  // municipality name (see syncSearchMunicipality), so filteredListings can widen matchesTerm —
  // not narrow it with an AND like the dropdown's matchesMunicipality does — to also include
  // listings whose free-text address doesn't mention the municipality but which fall inside its
  // shape. Independent state from municipalityFilter/municipalityPolygon so picking one doesn't
  // affect the other.
  private readonly searchMunicipalityPolygon = signal<google.maps.Polygon | null>(null);
  private searchMunicipalityCvegeo: string | null = null;
  private searchMunicipalityRequestId = 0;

  readonly showAgebLayer = signal(false);
  // The opt-in "mapa de color competitivo" layer — fetched once per click (not on every pan,
  // unlike showAgebLayer above) for whichever opportunity category is currently selected. See
  // loadCompetitorDensity.
  readonly loadingCompetitorDensity = signal(false);
  readonly competitorDensityActive = signal(false);
  readonly showSaveSearchForm = signal(false);
  readonly saveSearchName = signal('');

  // Mobile-only: which pane the map/list toggle currently shows (<=860px — see
  // map-view.component.css's own breakpoint). Unused above that width, where map and list
  // render side by side as before.
  readonly mobileView = signal<'map' | 'results'>('map');
  // Mobile-only: the full-screen filters page, reached from the compact search bar's "Filtros"
  // button. Desktop keeps the always-visible inline filter row instead.
  readonly mobileFiltersOpen = signal(false);

  // Drives the badge on the mobile "Filtros" button, same idea as Zillow's filter-count chip —
  // the main search text box doesn't count here, only the fields the filters page actually edits.
  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.typeFilter() !== 'sale') count++;
    if (this.propertyTypeFilter() !== 'all') count++;
    if (this.minPrice() !== null) count++;
    if (this.maxPrice() !== null) count++;
    if (this.minBeds() !== 'any') count++;
    if (this.minBaths() !== 'any') count++;
    if (this.companyFilter().trim()) count++;
    if (this.municipalityFilter()) count++;
    return count;
  });

  readonly filteredListings = computed(() => {
    const term = this.search().trim().toLowerCase();
    const type = this.typeFilter();
    const propertyType = this.propertyTypeFilter();
    const minP = this.minPrice();
    const maxP = this.maxPrice();
    const minBd = this.minBeds();
    const minBa = this.minBaths();
    const company = this.companyFilter().trim().toLowerCase();
    const polygon = this.municipalityPolygon();
    const searchShape = this.searchMunicipalityPolygon();

    return this.listingService.listings().filter((listing) => {
      const matchesTerm =
        !term ||
        listing.title.toLowerCase().includes(term) ||
        listing.address.toLowerCase().includes(term) ||
        (searchShape != null &&
          listing.lat != null &&
          listing.lng != null &&
          google.maps.geometry.poly.containsLocation(new google.maps.LatLng(listing.lat, listing.lng), searchShape));
      const matchesType = type === 'all' || listing.type === type;
      const matchesPropertyType = propertyType === 'all' || listing.propertyType === propertyType;
      const matchesMinPrice = minP === null || listing.price >= minP;
      const matchesMaxPrice = maxP === null || listing.price <= maxP;
      const matchesBeds = minBd === 'any' || listing.bedrooms >= minBd;
      const matchesBaths = minBa === 'any' || listing.bathrooms >= minBa;
      const matchesCompany = !company || (listing.ownerCompany?.toLowerCase().includes(company) ?? false);
      const matchesMunicipality =
        !polygon ||
        (listing.lat != null &&
          listing.lng != null &&
          google.maps.geometry.poly.containsLocation(new google.maps.LatLng(listing.lat, listing.lng), polygon));
      return (
        matchesTerm &&
        matchesType &&
        matchesPropertyType &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesBeds &&
        matchesBaths &&
        matchesCompany &&
        matchesMunicipality
      );
    });
  });

  private readonly mapBounds = signal<google.maps.LatLngBounds | null>(null);

  // Only listings whose marker is currently visible in the map's viewport — mirrors the
  // filtered set further by pan/zoom, the same way Zillow's results list follows the map. When a
  // freehand shape has been drawn, it takes over entirely in place of the rectangular viewport —
  // the visitor drew that shape specifically to define "the area I care about," so a listing just
  // outside it shouldn't reappear just because it's still inside the map's bounding box.
  readonly visibleListings = computed(() => {
    const bounds = this.mapBounds();
    const shape = this.freehandShape();

    return this.filteredListings().filter((listing) => {
      if (listing.lat == null || listing.lng == null) return false;
      if (shape) return google.maps.geometry.poly.containsLocation(new google.maps.LatLng(listing.lat, listing.lng), shape);
      if (!bounds) return true; // map hasn't reported its viewport yet
      return bounds.contains({ lat: listing.lat, lng: listing.lng });
    });
  });

  private map?: google.maps.Map;
  private marker?: google.maps.Marker;
  private myLocationMarker?: google.maps.Marker;
  // Dropped by searchAddress() when the search box resolves to a plain address/coordinate with
  // no listing of its own to show a marker already — cleared the moment the search term changes
  // again (see onSearchChange) so it never lingers once the visitor moves on to a new query.
  private searchResultMarker?: google.maps.Marker;
  private opportunityCircle?: google.maps.Circle;
  private opportunityMarker?: google.maps.Marker;
  private agebDataLayer?: google.maps.Data;
  private competitorDensityLayer?: google.maps.Data;
  // Freehand drawing is hand-rolled from the map's own mousedown/mousemove/mouseup events rather
  // than the Maps JS API's old Drawing library — that library (google.maps.drawing.DrawingManager)
  // was removed from the API as of version 3.65 (its type is still shipped, but empty/deprecated;
  // confirmed via node_modules/@types/google.maps — there is no functioning replacement to swap
  // in, so this page implements the same "trace a shape, see what falls inside it" idea directly).
  private readonly freehandListeners: google.maps.MapsEventListener[] = [];
  private freehandDrawing = false;
  private freehandPath: google.maps.LatLng[] = [];
  private freehandPolyline?: google.maps.Polyline;
  // Guards against a slow response overwriting fresher AGEBs after another pan/zoom or an
  // uncheck — same shape as poiRequestIds, one counter since only one AGEB fetch is ever in
  // flight (unlike POI's one-counter-per-category).
  private agebRequestId = 0;
  // Bumped by every code path that opens the shared infoWindow (a listing/POI marker click, or
  // this feature's own search) — an async opportunity search checks it against the value it
  // captured when the search started, so a slow response can't steal focus back from a listing
  // or POI popup the user has since opened while it was in flight.
  private infoWindowGeneration = 0;
  // True only while the shared infoWindow is currently showing this feature's own content —
  // read by clearOpportunityOverlay so toggling the mode off doesn't close a listing/POI popup
  // that has since taken the window over.
  private infoWindowShowsOpportunity = false;
  // Set from a /listings/{id} "view on map" link's listingId query param — opened the first time
  // its marker exists in listingMarkers (renderListingMarkers runs async relative to the map's
  // own init), then cleared so a later marker re-render doesn't keep stealing focus back to it.
  private pendingFocusListingId: string | null = null;
  private readonly listingMarkers = new Map<string, google.maps.Marker>();
  private readonly fraccionamientoMarkers = new Map<string, google.maps.Marker>();
  private readonly brokerageMarkers = new Map<number, google.maps.Marker>();
  // One clusterer per marker type (listings + fraccionamientos + brokerages + one per POI
  // category) so a cluster icon never mixes categories together, keeping each type's color
  // meaningful when markers group up.
  private listingClusterer?: MarkerClusterer;
  private fraccionamientoClusterer?: MarkerClusterer;
  private brokerageClusterer?: MarkerClusterer;
  private readonly poiClusterers = new Map<PoiCategoryKey, MarkerClusterer>();
  private readonly poiRequestIds = new Map<PoiCategoryKey, number>();
  private infoWindow?: google.maps.InfoWindow;
  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly zone: NgZone,
    private readonly listingService: ListingService,
    private readonly translation: TranslationService,
    private readonly notification: NotificationService,
    protected readonly auth: AuthService,
    protected readonly favorites: FavoritesService,
    protected readonly comparison: ComparisonService,
    private readonly brokerageService: BrokerageService,
    private readonly savedSearchService: SavedSearchService,
    private readonly geomarketingService: GeomarketingService,
    private readonly fraccionamientoService: FraccionamientoService,
    seo: SeoService
  ) {
    seo.set({
      title: 'Mapa de propiedades',
      description: 'Explora propiedades en venta y renta en un mapa interactivo, filtra por zona, precio y tipo.',
      path: '/map'
    });

    // Re-render markers whenever the filtered listings or the logged-in user change (so "my
    // listings" stay correctly highlighted, and the map mirrors the list), without a full reload.
    effect(() => {
      this.filteredListings();
      this.auth.currentUser();
      if (this.map) {
        this.renderListingMarkers();
      }
    });

    this.brokerageService.search().subscribe((names) => this.brokerages.set(names));
    this.municipalities = this.geomarketingService.municipalities;
  }

  ngAfterViewInit(): void {
    this.waitForGoogleMaps();
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
    this.detachFreehandListeners();
  }

  private waitForGoogleMaps(): void {
    if (typeof google !== 'undefined' && google.maps) {
      // Deferred a tick even on this already-loaded path (e.g. navigating back to /map with the
      // script already cached): calling initMap synchronously here runs it inside the same
      // change-detection pass as ngAfterViewInit itself, and initMap eventually sets `mapReady`
      // — a value that pass already rendered — which trips Angular's dev-mode
      // ExpressionChangedAfterItHasBeenCheckedError (NG0100). setTimeout hands it a fresh
      // macrotask/CD cycle instead, matching how the polling branch below already behaves.
      setTimeout(() => this.initMap());
      return;
    }

    this.pollHandle = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps) {
        clearInterval(this.pollHandle);
        this.initMap();
      }
    }, GOOGLE_LOAD_POLL_MS);

    setTimeout(() => {
      if (this.pollHandle) {
        clearInterval(this.pollHandle);
        if (typeof google === 'undefined' || !google.maps) {
          this.hasError = true;
        }
      }
    }, 10000);
  }

  // A /listings/{id} "view on map" link takes priority over the "most recent listing" default
  // below — the visitor came here to see THIS property, not whatever's newest. lat/lng travel as
  // their own query params (not just listingId) so centering never has to wait on this.listings()
  // having loaded that listing yet; listingId alone is used afterward, once markers render, to
  // open its info window (see renderListingMarkers).
  private resolveQueryParamCenter(): google.maps.LatLngLiteral | null {
    const params = this.route.snapshot.queryParamMap;
    const latParam = params.get('lat');
    const lngParam = params.get('lng');
    // Number(null) is 0, not NaN — without the null checks below, plain /map (no query params
    // at all) would silently resolve to {lat:0, lng:0} instead of falling through to the
    // "most recent listing" default.
    if (latParam == null || lngParam == null) return null;

    const lat = Number(latParam);
    const lng = Number(lngParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    this.pendingFocusListingId = params.get('listingId');
    return { lat, lng };
  }

  // The most recently added listing is what a visitor almost always actually wants to see first
  // (geolocation previously drove this instead, but that's "where the visitor happens to be,"
  // not "what's new" — the two rarely match for this kind of browsing). Resolves to
  // DEFAULT_CENTER when the fetch fails or there are no listings yet, so a slow/broken request
  // here can never block the map from opening.
  private async resolveInitialCenter(): Promise<google.maps.LatLngLiteral> {
    const queryParamCenter = this.resolveQueryParamCenter();
    if (queryParamCenter) return queryParamCenter;

    try {
      const latest = await firstValueFrom(this.listingService.fetchLatest().pipe(timeout(INITIAL_CENTER_TIMEOUT_MS)));
      if (latest?.lat != null && latest?.lng != null) {
        return { lat: latest.lat, lng: latest.lng };
      }
    } catch {
      // Falls through to DEFAULT_CENTER below.
    }
    return DEFAULT_CENTER;
  }

  private initMap(): void {
    this.resolveInitialCenter().then((center) => {
      this.zone.run(() => {
        this.buildMap(center);
        this.mapReady = true;
      });
    });
  }

  // Shared by the initial load and the late-geolocation/recenter-button paths so "my location"
  // is always drawn the same way instead of three slightly different inline copies of it.
  private placeMyLocationMarker(location: google.maps.LatLngLiteral): void {
    if (this.myLocationMarker) {
      this.myLocationMarker.setPosition(location);
      // Title isn't reactive like the template — refresh it too, in case the user switched
      // language since the marker was first created.
      this.myLocationMarker.setTitle(this.translation.t('map.myLocation'));
    } else {
      this.myLocationMarker = new google.maps.Marker({
        position: location,
        map: this.map,
        title: this.translation.t('map.myLocation'),
        // A plain blue dot (Google's own "current location" convention) instead of a pin icon —
        // reads as "you are here" without competing with the add-property flow's own marker,
        // which uses the map's normal default pin.
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + 1
      });
    }
  }

  private buildMap(center: google.maps.LatLngLiteral): void {
    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: true,
      streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      // Left disabled, not re-enabled after removing our own expand button — the real Fullscreen
      // API (and Google's native control, which relies on it) can silently no-op when this page
      // is viewed inside an embedding context with a restrictive permissions policy (confirmed:
      // requestFullscreen() throws there even though document.fullscreenEnabled reports true).
      fullscreenControl: false
    });
    this.infoWindow = new google.maps.InfoWindow();

    // Joins Google's own zoom control in the same corner — pushing into the controls array
    // (rather than absolutely positioning our own button against pixel guesses about where
    // Google's native UI happens to sit) stacks it correctly above zoom regardless of Maps JS
    // version/theme, and matches the look of a native "my location" control.
    this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(this.locateBtnEl.nativeElement);

    // The pegman opens Street View in the same panorama Google attaches to this map (not a
    // separate view) — listening for its own visible_changed is how the toolbar knows to hide
    // itself, rather than trying to infer "in street view" from the pegman control's own state.
    const streetView = this.map.getStreetView();
    streetView.addListener('visible_changed', () => {
      this.zone.run(() => this.streetViewActive.set(streetView.getVisible()));
    });

    this.listingClusterer = new MarkerClusterer({
      map: this.map,
      algorithmOptions: CLUSTER_ALGORITHM_OPTIONS,
      renderer: createClusterRenderer('#000000')
    });

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      // The info-window's own close button is hidden (see .gm-ui-hover-effect in styles.css),
      // so clicking anywhere else on the map is the only way left to dismiss it.
      this.infoWindow?.close();

      if (!event.latLng || this.freehandMode) return;
      if (this.addMode || this.addBrokerageMode) {
        this.zone.run(() => this.placeMarker(event.latLng!));
      } else if (this.opportunityMode) {
        this.zone.run(() => this.analyzeOpportunity(event.latLng!));
      }
    });

    // Fires after every pan/zoom settles (and once on initial load) — keeps the results
    // list scoped to whatever's actually visible on the map right now.
    this.map.addListener('idle', () => {
      this.zone.run(() => {
        this.mapBounds.set(this.map!.getBounds() ?? null);
        // Unlike POI markers (a billed Places API call, deliberately searched once per check —
        // see togglePoiCategory), AGEBs are our own indexed Postgres query, cheap enough to
        // refetch on every pan/zoom so the layer actually follows the viewport.
        if (this.showAgebLayer()) this.loadAgebsForCurrentBounds();
      });
    });

    this.renderListingMarkers();
    this.loadFraccionamientos();
    this.loadBrokerages();
  }

  // Fetched once per map load (not bounds-driven like listings) and rendered as their own
  // clustered layer — a visitor should see every published development regardless of the
  // current viewport, same as they'd see it from the /fraccionamientos list page.
  private loadFraccionamientos(): void {
    this.fraccionamientoService.listPublished({ pageSize: FRACCIONAMIENTOS_MAP_PAGE_SIZE }).subscribe({
      next: (result) => this.zone.run(() => this.renderFraccionamientoMarkers(result.items)),
      // Silent failure: the map's core purpose (browsing listings) still works without this
      // layer, so a fraccionamientos-fetch error shouldn't surface a toast over the whole page.
      error: () => {}
    });
  }

  private renderFraccionamientoMarkers(items: FraccionamientoPublicListItem[]): void {
    this.fraccionamientoClusterer?.clearMarkers();
    this.fraccionamientoMarkers.clear();

    const markers = items.map((frac) => {
      const marker = new google.maps.Marker({
        position: { lat: frac.latitude, lng: frac.longitude },
        title: frac.name,
        icon: FRACCIONAMIENTO_ICON
      });

      marker.addListener('click', () => {
        this.zone.run(() => this.handleMarkerClick(marker.getPosition(), () => this.openFraccionamientoInfo(frac, marker)));
      });

      this.fraccionamientoMarkers.set(frac.id, marker);
      return marker;
    });

    if (!this.fraccionamientoClusterer) {
      this.fraccionamientoClusterer = new MarkerClusterer({
        map: this.map,
        algorithmOptions: CLUSTER_ALGORITHM_OPTIONS,
        renderer: createClusterRenderer(FRACCIONAMIENTO_CLUSTER_COLOR)
      });
    }
    this.fraccionamientoClusterer.addMarkers(markers);
  }

  // Fetched once per map load, same reasoning as loadFraccionamientos — every admin-pinned
  // brokerage should show regardless of viewport, and the row count is small (admin-curated, not
  // every brokerage in the directory).
  private loadBrokerages(): void {
    this.brokerageService.listForMap().subscribe({
      next: (items) => this.zone.run(() => this.renderBrokerageMarkers(items)),
      // Silent failure, same reasoning as loadFraccionamientos — this is an extra layer on top
      // of the map's core purpose, not something that should surface a toast over the whole page.
      error: () => {}
    });
  }

  private renderBrokerageMarkers(items: AgencyMapItem[]): void {
    this.brokerageClusterer?.clearMarkers();
    this.brokerageMarkers.clear();

    const markers = items.map((agency) => {
      const marker = new google.maps.Marker({
        position: { lat: agency.latitude, lng: agency.longitude },
        title: agency.name,
        icon: BROKERAGE_ICON
      });

      marker.addListener('click', () => {
        this.zone.run(() => this.handleMarkerClick(marker.getPosition(), () => this.openBrokerageInfo(agency, marker)));
      });

      this.brokerageMarkers.set(agency.id, marker);
      return marker;
    });

    if (!this.brokerageClusterer) {
      this.brokerageClusterer = new MarkerClusterer({
        map: this.map,
        algorithmOptions: CLUSTER_ALGORITHM_OPTIONS,
        renderer: createClusterRenderer(BROKERAGE_CLUSTER_COLOR)
      });
    }
    this.brokerageClusterer.addMarkers(markers);
  }

  private openBrokerageInfo(agency: AgencyMapItem, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;
    this.infoWindowGeneration++;
    this.infoWindowShowsOpportunity = false;

    const navigate = (event: Event) => {
      event.preventDefault();
      this.zone.run(() => this.router.navigate(['/inmobiliarias', toSlug(agency.name)]));
    };

    const container = document.createElement('div');
    container.className = 'map-info-card';

    if (agency.logoUrl) {
      const media = document.createElement('div');
      media.className = 'map-info-media';
      media.style.cursor = 'pointer';
      media.addEventListener('click', navigate);

      const img = document.createElement('img');
      img.src = agency.logoUrl;
      img.alt = agency.name;
      media.appendChild(img);

      container.appendChild(media);
    }

    const body = document.createElement('div');
    body.className = 'map-info-body';

    const titleEl = document.createElement('p');
    titleEl.className = 'map-info-title';
    titleEl.textContent = agency.name;
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', navigate);
    body.appendChild(titleEl);

    container.appendChild(body);

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  private openFraccionamientoInfo(frac: FraccionamientoPublicListItem, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;
    this.infoWindowGeneration++;
    this.infoWindowShowsOpportunity = false;

    const navigate = (event: Event) => {
      event.preventDefault();
      this.zone.run(() => this.router.navigate(['/fraccionamientos', frac.id]));
    };

    const container = document.createElement('div');
    container.className = 'map-info-card';

    if (frac.masterPlanImageUrl) {
      const media = document.createElement('div');
      media.className = 'map-info-media';
      media.style.cursor = 'pointer';
      media.addEventListener('click', navigate);

      const img = document.createElement('img');
      img.src = frac.masterPlanImageUrl;
      img.alt = frac.name;
      media.appendChild(img);

      if (frac.stage) {
        const badge = document.createElement('span');
        badge.className = 'map-info-badge';
        badge.textContent = frac.stage;
        media.appendChild(badge);
      }

      container.appendChild(media);
    }

    const body = document.createElement('div');
    body.className = 'map-info-body';

    const titleEl = document.createElement('p');
    titleEl.className = 'map-info-title';
    titleEl.textContent = frac.name;
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', navigate);
    body.appendChild(titleEl);

    if (frac.developerName) {
      const developerEl = document.createElement('p');
      developerEl.className = 'map-info-address';
      developerEl.textContent = frac.developerName;
      body.appendChild(developerEl);
    }

    const locationEl = document.createElement('p');
    locationEl.className = 'map-info-address';
    locationEl.textContent = !frac.masterPlanImageUrl && frac.stage ? `${frac.city}, ${frac.state} · ${frac.stage}` : `${frac.city}, ${frac.state}`;
    body.appendChild(locationEl);

    container.appendChild(body);

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  private renderListingMarkers(): void {
    // A filter/auth change re-renders every marker from scratch while a pin is mid-drag (see
    // the effect that calls this) — without carrying its current dragged position and
    // draggable state over to the freshly-created marker, the drag would silently reset to the
    // listing's saved position with the "editar ubicación" banner still showing, and "Guardar"
    // would then just re-save that unchanged position with no indication the edit was lost.
    const editingId = this.editingLocationListingId();
    const editingPosition = editingId ? this.listingMarkers.get(editingId)?.getPosition() ?? null : null;

    this.listingClusterer?.clearMarkers();
    this.listingMarkers.clear();

    const listings = this.filteredListings().filter((listing) => listing.lat != null && listing.lng != null);
    const currentUserId = this.auth.currentUser()?.id;
    const markers: google.maps.Marker[] = [];

    for (const listing of listings) {
      const isEditing = listing.id === editingId;
      const marker = new google.maps.Marker({
        position: isEditing && editingPosition ? { lat: editingPosition.lat(), lng: editingPosition.lng() } : { lat: listing.lat!, lng: listing.lng! },
        title: listing.title,
        icon: listing.ownerId === currentUserId ? MY_LISTING_ICON : undefined,
        draggable: isEditing
      });

      marker.addListener('click', () => {
        this.zone.run(() => this.handleMarkerClick(marker.getPosition(), () => this.openListingInfo(listing, marker)));
      });

      // Only ever fires while this marker is draggable (i.e. mid-edit) — keeps the banner's
      // lat/lng inputs mirroring a drag in progress, the same way applyEditingCoordinates keeps
      // the marker mirroring those inputs.
      marker.addListener('drag', () => {
        if (listing.id !== this.editingLocationListingId()) return;
        const pos = marker.getPosition();
        if (!pos) return;
        this.zone.run(() => {
          this.editingLat.set(pos.lat());
          this.editingLng.set(pos.lng());
        });
      });

      this.listingMarkers.set(listing.id, marker);
      markers.push(marker);
    }

    this.listingClusterer?.addMarkers(markers);

    if (this.pendingFocusListingId) {
      const focusMarker = this.listingMarkers.get(this.pendingFocusListingId);
      const focusListing = listings.find((listing) => listing.id === this.pendingFocusListingId);
      if (focusMarker && focusListing) {
        this.openListingInfo(focusListing, focusMarker);
        this.pendingFocusListingId = null;
      }
    }
  }

  private openListingInfo(listing: Listing, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;
    this.infoWindowGeneration++;
    this.infoWindowShowsOpportunity = false;

    // Matches ListingCardComponent's formatting exactly (Angular's CurrencyPipe with no
    // digitsInfo override defaults to 2 decimal places) so the same listing never shows a
    // different price on its card vs. its map marker popup. Same priceOnRequest/price<=0 check
    // as the card too — otherwise this would show a misleading "$0".
    const price = listing.priceOnRequest || listing.price <= 0
      ? this.translation.t('listing.priceOnRequest')
      : new Intl.NumberFormat(undefined, { style: 'currency', currency: listing.currency }).format(listing.price);

    const navigate = (event: Event) => {
      event.preventDefault();
      this.zone.run(() => this.router.navigate(['/listings', listing.id]));
    };

    const container = document.createElement('div');
    container.className = 'map-info-card';

    // --- media: photo + property-type badge + for sale/rent tag + favorite toggle ---
    const media = document.createElement('div');
    media.className = 'map-info-media';
    media.style.cursor = 'pointer';
    media.addEventListener('click', navigate);

    const img = document.createElement('img');
    img.src = listing.imageUrls[0] ?? DEFAULT_LISTING_IMAGE;
    img.alt = listing.title;
    media.appendChild(img);

    if (listing.propertyType) {
      const badge = document.createElement('span');
      badge.className = 'map-info-badge';
      badge.textContent = this.translation.t(`listingForm.${listing.propertyType}`);
      media.appendChild(badge);
    }

    const tag = document.createElement('span');
    tag.className = listing.type === 'rent' ? 'map-info-tag rent' : 'map-info-tag';
    tag.textContent = this.translation.t(listing.type === 'rent' ? 'listingForm.forRent' : 'listingForm.forSale');
    media.appendChild(tag);

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'map-info-fav';
    favBtn.setAttribute('aria-label', this.translation.t('listingDetail.favorite'));
    const syncFavState = () => {
      const active = this.favorites.isFavorite(listing.id);
      // Same heart path as the listing card / listing detail page, so the icon looks
      // identical everywhere rather than relying on the browser's Unicode heart glyph.
      favBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>`;
      favBtn.setAttribute('aria-pressed', String(active));
      favBtn.classList.toggle('active', active);
    };
    syncFavState();
    favBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.zone.run(() => {
        this.favorites.toggle(listing.id);
        syncFavState();
      });
    });
    media.appendChild(favBtn);

    container.appendChild(media);

    // --- body: price, stats line, title, address ---
    const body = document.createElement('div');
    body.className = 'map-info-body';

    const hasRealPrice = !listing.priceOnRequest && listing.price > 0;
    const priceEl = document.createElement('p');
    priceEl.className = 'map-info-price';
    priceEl.textContent = price + (hasRealPrice && listing.type === 'rent' ? this.translation.t('listing.perMonthSuffix') : '');
    body.appendChild(priceEl);

    if (listing.type === 'sale' && hasRealPrice) {
      const monthlyPayment = calculateMonthlyPayment(
        listing.price,
        DEFAULT_DOWN_PAYMENT_PERCENT,
        DEFAULT_INTEREST_RATE_PERCENT,
        DEFAULT_TERM_YEARS
      );
      const formattedPayment = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: listing.currency,
        maximumFractionDigits: 0
      }).format(monthlyPayment);

      const mortgageEl = document.createElement('p');
      mortgageEl.className = 'map-info-mortgage';
      mortgageEl.innerHTML =
        `${this.translation.t('listing.estMonthlyPayment')} ${formattedPayment}${this.translation.t('listing.perMonthSuffix')} ` +
        `<span class="map-info-tooltip" title="${this.translation.t('listing.mortgageTooltip')}">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>` +
        `</span>`;
      body.appendChild(mortgageEl);
    }

    const statsEl = document.createElement('p');
    statsEl.className = 'map-info-stats';
    statsEl.innerHTML =
      `<strong>${listing.bedrooms}</strong> ${this.translation.t('listing.bedroomsAbbr')}` +
      ` <span class="sep">|</span> <strong>${listing.bathrooms}</strong> ${this.translation.t('listing.bathroomsAbbr')}` +
      ` <span class="sep">|</span> <strong>${listing.areaSqm}</strong> m²`;
    body.appendChild(statsEl);

    const titleEl = document.createElement('p');
    titleEl.className = 'map-info-title';
    titleEl.textContent = listing.title;
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', navigate);
    body.appendChild(titleEl);

    const addressEl = document.createElement('p');
    addressEl.className = 'map-info-address';
    addressEl.textContent = listing.address;
    body.appendChild(addressEl);

    if (listing.ownerId === this.auth.currentUser()?.id) {
      const editLocationBtn = document.createElement('button');
      editLocationBtn.type = 'button';
      editLocationBtn.className = 'map-info-edit-location';
      editLocationBtn.textContent = this.translation.t('map.editLocation');
      editLocationBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.zone.run(() => this.startEditingLocation(listing));
      });
      body.appendChild(editLocationBtn);
    }

    container.appendChild(body);

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  // Drives the "arrastra el marcador…" banner (template) while a listing's pin is being
  // repositioned — only ever set for a listing the signed-in user owns (see openListingInfo's
  // "editar ubicación" button, the only place this is set).
  readonly editingLocationListingId = signal<string | null>(null);
  readonly savingLocation = signal(false);
  // The banner's own lat/lng number inputs — the second way to move the pin, alongside
  // dragging. Kept in sync with the marker's actual position in both directions: dragging
  // updates these (see the 'drag' listener wired in renderListingMarkers) and typing into them
  // moves the marker (see onEditingLatChange/onEditingLngChange below).
  readonly editingLat = signal<number | null>(null);
  readonly editingLng = signal<number | null>(null);
  // Captured when editing starts so cancelEditingLocation can snap the marker back if the edit
  // is abandoned, without needing a round-trip to the server.
  private editingLocationOriginalPosition: google.maps.LatLngLiteral | null = null;

  startEditingLocation(listing: Listing): void {
    // Only one pin can be mid-drag at a time — abandon whichever one was already being edited
    // (snapping it back) before letting this one go draggable.
    this.cancelEditingLocation();

    const marker = this.listingMarkers.get(listing.id);
    if (!marker || listing.lat == null || listing.lng == null) return;

    this.infoWindow?.close();
    this.editingLocationOriginalPosition = { lat: listing.lat, lng: listing.lng };
    this.editingLocationListingId.set(listing.id);
    this.editingLat.set(listing.lat);
    this.editingLng.set(listing.lng);
    marker.setDraggable(true);
  }

  cancelEditingLocation(): void {
    const id = this.editingLocationListingId();
    if (!id) return;

    const marker = this.listingMarkers.get(id);
    if (marker && this.editingLocationOriginalPosition) {
      marker.setPosition(this.editingLocationOriginalPosition);
    }
    marker?.setDraggable(false);
    this.editingLocationListingId.set(null);
    this.editingLat.set(null);
    this.editingLng.set(null);
    this.editingLocationOriginalPosition = null;
  }

  saveEditingLocation(): void {
    const id = this.editingLocationListingId();
    const marker = id ? this.listingMarkers.get(id) : undefined;
    const position = marker?.getPosition();
    if (!id || !marker || !position) return;

    this.savingLocation.set(true);
    this.listingService.updateLocation(id, position.lat(), position.lng()).subscribe({
      next: () => {
        this.zone.run(() => {
          this.savingLocation.set(false);
          marker.setDraggable(false);
          this.editingLocationListingId.set(null);
          this.editingLat.set(null);
          this.editingLng.set(null);
          this.editingLocationOriginalPosition = null;
          this.notification.success('map.editLocationSaved');
        });
      },
      error: () => {
        this.zone.run(() => {
          this.savingLocation.set(false);
          this.notification.error('map.editLocationError');
        });
      }
    });
  }

  // The manual-coordinates half of the banner — typing a value moves the marker (and recenters
  // the map on it) exactly as a drag would, so saveEditingLocation (which just reads the
  // marker's current position) works unchanged for either input method. Invalid/empty input is
  // ignored rather than moving the pin to NaN,NaN; out-of-range input is clamped rather than
  // rejected outright, matching the backend's own [Range(-90,90)]/[Range(-180,180)] on
  // ListingLocationUpdateDto — otherwise a stray extra digit would round-trip a 400 instead of
  // just landing the pin at the nearest valid coordinate.
  onEditingLatChange(value: string): void {
    const lat = Number(value);
    if (value.trim() === '' || !Number.isFinite(lat)) return;
    this.editingLat.set(Math.min(90, Math.max(-90, lat)));
    this.applyEditingCoordinates();
  }

  onEditingLngChange(value: string): void {
    const lng = Number(value);
    if (value.trim() === '' || !Number.isFinite(lng)) return;
    this.editingLng.set(Math.min(180, Math.max(-180, lng)));
    this.applyEditingCoordinates();
  }

  private applyEditingCoordinates(): void {
    const id = this.editingLocationListingId();
    const marker = id ? this.listingMarkers.get(id) : undefined;
    const lat = this.editingLat();
    const lng = this.editingLng();
    if (!marker || lat == null || lng == null) return;

    marker.setPosition({ lat, lng });
    this.map?.panTo({ lat, lng });
  }

  // Wired to the explicit "recenter" map button (template) — wrapped in zone.run since the
  // geolocation callback isn't guaranteed to run inside Angular's zone, and locatingMe is bound
  // in the template. notifyOnError is on here (an explicit click deserves feedback if it fails),
  // unlike the silent initial-load attempt in resolveInitialCenter.
  centerOnCurrentLocation(notifyOnError = false): void {
    if (!navigator.geolocation) return;

    this.locatingMe = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.zone.run(() => {
          this.locatingMe = false;
          const here = { lat: position.coords.latitude, lng: position.coords.longitude };
          this.map?.setCenter(here);
          this.map?.setZoom(DEFAULT_ZOOM);
          this.placeMyLocationMarker(here);
        });
      },
      () => {
        // Denied, unavailable, or timed out: keep wherever the map currently is.
        this.zone.run(() => {
          this.locatingMe = false;
          if (notifyOnError) {
            this.notification.error('map.locationError');
          }
        });
      },
      { timeout: 8000 }
    );
  }

  private placeMarker(latLng: google.maps.LatLng): void {
    this.selectedLat = latLng.lat();
    this.selectedLng = latLng.lng();

    if (this.marker) {
      this.marker.setPosition(latLng);
    } else {
      this.marker = new google.maps.Marker({ position: latLng, map: this.map, draggable: true });
      this.marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        this.zone.run(() => {
          this.selectedLat = event.latLng!.lat();
          this.selectedLng = event.latLng!.lng();
        });
      });
    }
  }

  // Shared by every marker's own click handler (listing, fraccionamiento, brokerage): while the
  // opportunity tool is armed, a click on any of them means "analyze this point," same as a
  // click on open map — not whatever that marker would normally do (open its info window). A
  // marker's own click event never reaches the map's 'click' listener (that's just how Google
  // Maps dispatches these), so without this each marker would silently keep its old behavior
  // and ignore the armed tool entirely.
  private handleMarkerClick(position: google.maps.LatLng | null | undefined, openInfo: () => void): void {
    if (this.opportunityMode && position) {
      this.analyzeOpportunity(position);
      return;
    }
    openInfo();
  }

  // Counts nearby competitors of the selected category and draws a traffic-light circle from
  // the count. Two sources are queried in parallel: INEGI DENUE (Mexico's official business
  // registry, proxied through our backend — see GeomarketingService) and Google Places Nearby
  // Search (the same API the POI checklist already uses, just radius-scoped to a clicked point
  // instead of the whole viewport). DENUE is preferred when it succeeds; Places is the fallback
  // (including today, while DenueOptions still holds its CHANGE_ME placeholder token). Adding a
  // new business type means adding an OPPORTUNITY_CATEGORIES entry, not a second version of this
  // method.
  private async analyzeOpportunity(latLng: google.maps.LatLng): Promise<void> {
    if (!this.map) return;

    const categoryKey = this.selectedOpportunityCategory();
    if (!categoryKey) return;
    const config = OPPORTUNITY_CATEGORIES.find((c) => c.key === categoryKey)!;
    const position = { lat: latLng.lat(), lng: latLng.lng() };
    // Also serves as the "info window generation" this request was started at — see
    // infoWindowGeneration's own comment for why that's what guards against a stale response.
    const requestId = ++this.infoWindowGeneration;
    // Dismiss any still-open toast from a previous call before replacing the reference below —
    // otherwise a category switch fired while an earlier analysis is still in flight (now easy to
    // trigger, since selectOpportunityCategory can call this repeatedly without a map click)
    // orphans that earlier toast: disableTimeOut means it never clears on its own, and once this
    // field points at the new toast nothing can ever dismiss the old one again.
    if (this.opportunityLoadingToast) {
      this.notification.dismiss(this.opportunityLoadingToast);
    }
    this.opportunityLoadingToast = this.notification.loading('map.analyzing');

    const [placesCount, denueCount, population] = await Promise.all([
      this.searchPlacesCount(position, config.radiusMeters, config.placeType),
      this.searchDenueCount(position, config.radiusMeters, config.denueSearchTerm),
      this.searchPopulationDensity(position)
    ]);

    this.zone.run(() => {
      if (requestId !== this.infoWindowGeneration) return;
      if (this.opportunityLoadingToast) {
        this.notification.dismiss(this.opportunityLoadingToast);
        this.opportunityLoadingToast = null;
      }

      if (placesCount === null && denueCount === null) {
        this.notification.error('map.opportunityError');
        return;
      }

      const source: 'denue' | 'places' = denueCount !== null ? 'denue' : 'places';
      const count = denueCount ?? placesCount ?? 0;
      const level = opportunityLevel(count, config);
      const result: OpportunityAnalysisResult = { count, level, source, population };
      this.opportunityResult.set(result);
      this.drawOpportunityCircle(position, result, config.radiusMeters, config.icon, this.translation.t(config.pluralLabelKey));
    });
  }

  // Resolves to null (rather than rejecting) on any failure — analyzeOpportunity treats "one
  // source unavailable" as normal, not exceptional, since DENUE in particular is expected to
  // fail until a real token replaces the placeholder in DenueOptions.
  private searchPlacesCount(position: google.maps.LatLngLiteral, radiusMeters: number, placeType: string): Promise<number | null> {
    return new Promise((resolve) => {
      if (!this.map) {
        resolve(null);
        return;
      }
      const service = new google.maps.places.PlacesService(this.map);
      service.nearbySearch({ location: position, radius: radiusMeters, type: placeType }, (results, status) => {
        const ok = status === google.maps.places.PlacesServiceStatus.OK || status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS;
        resolve(ok ? results?.length ?? 0 : null);
      });
    });
  }

  private searchDenueCount(position: google.maps.LatLngLiteral, radiusMeters: number, searchTerm: string): Promise<number | null> {
    return firstValueFrom(this.geomarketingService.businessDensity(searchTerm, position.lat, position.lng, radiusMeters))
      .then((result) => result.count)
      .catch(() => null);
  }

  // Resolves to null both on error and on the (expected, not exceptional) 404 for a point
  // outside the states whose census data has been imported so far — see PopulationDensityService.
  private searchPopulationDensity(position: google.maps.LatLngLiteral): Promise<PopulationDensity | null> {
    return firstValueFrom(this.geomarketingService.populationDensity(position.lat, position.lng)).catch(() => null);
  }

  // Takes the already-built OpportunityAnalysisResult rather than its fields spread as loose
  // positional parameters — count and radiusMeters (both plain numbers) sat next to each other
  // in the old signature, one silent transposition away from mislabeling the popup or drawing
  // the wrong-radius circle with no compiler error to catch it.
  private drawOpportunityCircle(
    position: google.maps.LatLngLiteral,
    result: OpportunityAnalysisResult,
    radiusMeters: number,
    icon: string,
    categoryPluralLabel: string
  ): void {
    if (!this.map) return;
    const { level, count, source, population } = result;

    if (this.opportunityCircle) {
      this.opportunityCircle.setOptions({ center: position, radius: radiusMeters, strokeColor: level.color, fillColor: level.color });
    } else {
      this.opportunityCircle = new google.maps.Circle({
        map: this.map,
        center: position,
        radius: radiusMeters,
        strokeColor: level.color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: level.color,
        fillOpacity: 0.15,
        clickable: false
      });
    }

    // Zooms in (or out) to frame the whole radius, not just centers on it — a 300 m pharmacy
    // check and a 2 km supermarket check need very different zoom levels, and the visitor
    // shouldn't have to zoom by hand to actually see the circle fitBounds just drew.
    const circleBounds = this.opportunityCircle.getBounds();
    if (circleBounds) this.map.fitBounds(circleBounds);

    if (this.opportunityMarker) {
      // Reusing the marker across analyses now matters: with a single category (pharmacy) every
      // analysis shared the same icon, but switching categories without closing the panel means
      // a reused marker must also pick up the new category's icon, not just move.
      this.opportunityMarker.setPosition(position);
      this.opportunityMarker.setIcon(icon);
    } else {
      this.opportunityMarker = new google.maps.Marker({ position, map: this.map, icon });
    }

    const label = this.translation.t(level.labelKey);
    const countLabel = this.translation.t('map.opportunityCompetitorCount', {
      count,
      category: categoryPluralLabel,
      radiusKm: radiusMeters / 1000
    });
    const sourceLabel = this.translation.t(source === 'denue' ? 'map.opportunitySourceDenue' : 'map.opportunitySourcePlaces');
    // Population is INEGI Census 2020 data, imported once for Puebla state only (see
    // AgebPopulation) — null anywhere else, which is expected coverage, not a failure, so it's
    // simply omitted rather than shown as an error line.
    const populationLine = population
      ? `<br>${this.translation.t('map.opportunityPopulationDensity', {
          density: Math.round(population.densityPerSqKm).toLocaleString(),
          year: population.censusYear
        })}`
      : '';
    // Same "only shown when present" rule as populationLine — null covers both an AGEB outside
    // the imported area and one INEGI's own data masking left with too little source data to
    // estimate (see SocioeconomicLevel), neither of which is worth surfacing as an error.
    const socioeconomicLevelKey = population?.estimatedSocioeconomicLevel
      ? SOCIOECONOMIC_LEVEL_LABEL_KEYS[population.estimatedSocioeconomicLevel]
      : null;
    const socioeconomicLine = socioeconomicLevelKey
      ? `<br>${this.translation.t('map.opportunitySocioeconomicLevel', { level: this.translation.t(socioeconomicLevelKey) })}`
      : '';
    this.infoWindow?.setContent(
      `<div class="opportunity-info"><strong>${label}</strong><br>${countLabel}<br><span class="opportunity-source">${sourceLabel}</span>${populationLine}${socioeconomicLine}</div>`
    );
    this.infoWindow?.setPosition(position);
    this.infoWindow?.open(this.map);
    this.infoWindowShowsOpportunity = true;
  }

  private clearOpportunityOverlay(): void {
    // Invalidates any in-flight analyzeOpportunity request in the same stroke as marking that
    // this feature no longer owns the info window, since both checks read this one counter.
    this.infoWindowGeneration++;
    if (this.opportunityLoadingToast) {
      this.notification.dismiss(this.opportunityLoadingToast);
      this.opportunityLoadingToast = null;
    }
    this.opportunityResult.set(null);
    this.opportunityCircle?.setMap(null);
    this.opportunityCircle = undefined;
    this.opportunityMarker?.setMap(null);
    this.opportunityMarker = undefined;

    // Only close the shared info window if it's still showing this feature's own content — a
    // listing/POI popup opened since (which already reset this flag itself) isn't ours to close.
    if (this.infoWindowShowsOpportunity) {
      this.infoWindow?.close();
      this.infoWindowShowsOpportunity = false;
    }
  }

  // Splits poiCategories by section for the grouped checklist template — a plain array filter,
  // not a signal/computed, since poiCategories itself is static (never reassigned after init).
  poiCategoriesInGroup(group: PoiGroupKey): PoiCategoryConfig[] {
    return this.poiCategories.filter((category) => category.group === group);
  }

  togglePoiChecklist(): void {
    this.showPoiChecklist.update((visible) => !visible);
    // Both picker panels are positioned near the same corner of the toolbar — having both open
    // at once visually overlaps them, so opening one closes the other.
    if (this.showPoiChecklist()) {
      this.closeOpportunityPicker();
      this.resetSheetCollapse();
    }
  }

  // Resets the collapse state whenever a panel (re)opens, so it always starts expanded rather
  // than carrying over whatever drag collapsed the previous panel.
  private resetSheetCollapse(): void {
    this.sheetCollapsed.set(false);
  }

  // Drag-based, matching how a native bottom sheet actually behaves: the finger's own direction
  // decides collapse/expand, not whether the list under it happens to scroll (a (scroll)-event
  // version of this — collapsing only once the list content itself scrolled — turned out to do
  // nothing on a real phone: dragging down from the top of an already-at-top list can't scroll
  // past 0, so no scroll event ever fired). Dragging down collapses the sheet to just its header;
  // dragging up restores it. The header (always visible, in every state) carries this for its own
  // surface; the body also gets it, but only once already scrolled to its own top — below that, a
  // downward drag is just the user scrolling through the category list, and must not also
  // collapse the sheet out from under them.
  // Pointer events rather than raw touch events — they unify mouse/touch/pen behind one API, so
  // this works the same way whether it's a finger on a phone or a mouse/trackpad on desktop,
  // without a separate touches[0]/touches.length dance.
  private pointerY = 0;
  // Touch (and some mouse) drags that pass the collapse/expand threshold still fire a trailing
  // `click` once the finger lifts — browsers don't suppress it just because touchmove happened.
  // Without this flag, a successful drag would immediately get undone by onSheetHeaderClick
  // reading it as a fresh tap and toggling back. Set once a drag actually crosses the threshold,
  // cleared by the next click it suppresses (or the next pointerdown, if no click follows).
  private sheetDragged = false;

  onSheetHeaderWheel(event: WheelEvent): void {
    this.applySheetDragDelta(event.deltaY);
  }

  // Belt-and-suspenders alongside the drag gesture above: tapping anywhere on the header other
  // than the close button also toggles collapsed/expanded. A plain click is the most basic,
  // universally reliable interaction there is — this guarantees the sheet is never stuck
  // collapsed (or impossible to collapse) on a device/browser combination where the drag tracking
  // above doesn't behave the way it does here.
  onSheetHeaderClick(event: MouseEvent): void {
    if (this.sheetDragged) {
      this.sheetDragged = false;
      return;
    }
    if ((event.target as HTMLElement).closest('.map-sheet-close')) {
      return;
    }
    this.sheetCollapsed.update((collapsed) => !collapsed);
  }

  onSheetPointerDown(event: PointerEvent): void {
    this.pointerY = event.clientY;
    this.sheetDragged = false;
  }

  onSheetHeaderPointerMove(event: PointerEvent): void {
    if (event.buttons === 0 && event.pointerType === 'mouse') {
      return;
    }
    this.applySheetDragDelta(event.clientY - this.pointerY);
    this.pointerY = event.clientY;
  }

  onSheetBodyPointerMove(event: PointerEvent): void {
    if (event.buttons === 0 && event.pointerType === 'mouse') {
      return;
    }
    const scrollTop = (event.currentTarget as HTMLElement).scrollTop;
    if (scrollTop <= 0) {
      this.applySheetDragDelta(event.clientY - this.pointerY);
    }
    this.pointerY = event.clientY;
  }

  // delta > 0: finger moved down since the last sample (collapse). delta < 0: moved up (expand).
  private applySheetDragDelta(delta: number): void {
    const threshold = 6;
    if (delta > threshold) {
      this.sheetDragged = true;
      this.sheetCollapsed.set(true);
    } else if (delta < -threshold) {
      this.sheetDragged = true;
      this.sheetCollapsed.set(false);
    }
  }

  // Shared by togglePoiChecklist's forced-close and toggleOpportunityChecklist's own close, so
  // both paths cancel click-to-analyze mode the same way — otherwise opening the POI panel would
  // hide the opportunity picker (and its "click to analyze" hint) while leaving the map silently
  // still armed to run an analysis on the next click.
  private closeOpportunityPicker(): void {
    this.showOpportunityChecklist.set(false);
    if (this.opportunityMode) {
      this.opportunityMode = false;
      this.clearOpportunityOverlay();
    }
  }

  // The panel's own close (X) button — same full reset as closeOpportunityPicker above (panel
  // closes, tool disarms, radius/marker/result clear from the map). Kept as its own method since
  // the template calls it from the panel itself rather than the toolbar toggle button.
  closeOpportunityChecklistPanel(): void {
    this.closeOpportunityPicker();
  }

  // Searches once per check, not on every pan/zoom — each search is a billed Places API call,
  // so refreshing continuously as the map moves would be needlessly expensive. Uncheck/check
  // again (or a future dedicated "refresh" affordance) re-searches the current view.
  togglePoiCategory(key: PoiCategoryKey, checked: boolean): void {
    this.checkedPoiCategories.update((set) => {
      const next = new Set(set);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

    if (checked) {
      this.searchPoiCategory(key);
    } else {
      // Bumping the request id invalidates any in-flight search so a late response can't
      // resurrect markers (or the "loading" state) for a category that's no longer checked.
      this.poiRequestIds.set(key, (this.poiRequestIds.get(key) ?? 0) + 1);
      this.loadingPoiCategories.update((set) => {
        const next = new Set(set);
        next.delete(key);
        return next;
      });
      this.clearPoiCategoryMarkers(key);
    }
  }

  private searchPoiCategory(key: PoiCategoryKey): void {
    const config = POI_CATEGORIES.find((c) => c.key === key);
    const bounds = this.map?.getBounds();
    if (!config || !this.map || !bounds) return;

    this.loadingPoiCategories.update((set) => new Set(set).add(key));
    const requestId = (this.poiRequestIds.get(key) ?? 0) + 1;
    this.poiRequestIds.set(key, requestId);

    const service = new google.maps.places.PlacesService(this.map);
    service.nearbySearch({ bounds, type: config.placeType, keyword: config.keyword }, (results, status) => {
      this.zone.run(() => {
        // Ignore responses to superseded searches (e.g. the user unchecked/rechecked, or
        // panned and re-triggered a search, before this one came back) — otherwise a slower
        // request can overwrite fresher markers with results from a stale viewport.
        if (requestId !== this.poiRequestIds.get(key)) return;

        this.loadingPoiCategories.update((set) => {
          const next = new Set(set);
          next.delete(key);
          return next;
        });
        this.clearPoiCategoryMarkers(key);

        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;

        const markers: google.maps.Marker[] = [];
        for (const place of results) {
          if (!place.geometry?.location) continue;
          const name = place.name ?? '';
          const marker = new google.maps.Marker({
            position: place.geometry.location,
            title: name,
            icon: config.icon
          });
          marker.addListener('click', () => this.zone.run(() => this.openPoiInfo(name, marker)));
          markers.push(marker);
        }
        this.getPoiClusterer(key).addMarkers(markers);
      });
    });
  }

  private getPoiClusterer(key: PoiCategoryKey): MarkerClusterer {
    let clusterer = this.poiClusterers.get(key);
    if (!clusterer) {
      const config = POI_CATEGORIES.find((c) => c.key === key)!;
      clusterer = new MarkerClusterer({
        map: this.map,
        algorithmOptions: CLUSTER_ALGORITHM_OPTIONS,
        renderer: createClusterRenderer(config.clusterColor)
      });
      this.poiClusterers.set(key, clusterer);
    }
    return clusterer;
  }

  private openPoiInfo(name: string, marker: google.maps.Marker): void {
    if (!this.infoWindow) return;
    this.infoWindowGeneration++;
    this.infoWindowShowsOpportunity = false;

    // textContent (not innerHTML) — the place name comes from the Places API, not our own data.
    const container = document.createElement('div');
    container.className = 'map-info-poi';
    container.textContent = name;

    this.infoWindow.setContent(container);
    this.infoWindow.open({ map: this.map, anchor: marker });
  }

  private clearPoiCategoryMarkers(key: PoiCategoryKey): void {
    this.poiClusterers.get(key)?.clearMarkers();
  }

  toggleAddMode(): void {
    this.addMode = !this.addMode;
    // Mutually exclusive with every other click-driven tool — all interpret a map click
    // differently, so leaving more than one on at once would make a click's effect ambiguous.
    if (this.addMode && this.opportunityMode) {
      this.opportunityMode = false;
      this.clearOpportunityOverlay();
    }
    if (this.addMode && this.freehandMode) {
      this.setFreehandMode(false);
    }
    if (this.addMode && this.addBrokerageMode) {
      this.addBrokerageMode = false;
    }
    // Turning add-mode off while a pin is already placed should drop it too — otherwise a
    // dangling marker (and the confirmation card, which is keyed off selectedLat/Lng) would
    // stick around after the visitor toggled the tool off.
    if (!this.addMode) {
      this.clearPendingLocation();
    }
  }

  // Admin-only counterpart to toggleAddMode — the resulting pin feeds confirmLocation's
  // 'inmobiliarias/new' branch instead of 'listings/new'. Same mutual-exclusivity rules as
  // toggleAddMode, mirrored onto this mode too.
  toggleAddBrokerageMode(): void {
    this.addBrokerageMode = !this.addBrokerageMode;
    if (this.addBrokerageMode && this.opportunityMode) {
      this.opportunityMode = false;
      this.clearOpportunityOverlay();
    }
    if (this.addBrokerageMode && this.freehandMode) {
      this.setFreehandMode(false);
    }
    if (this.addBrokerageMode && this.addMode) {
      this.addMode = false;
    }
    if (!this.addBrokerageMode) {
      this.clearPendingLocation();
    }
  }

  // Arms/disarms freehand-draw mode — mutually exclusive with every other click-driven tool on
  // this page, same reasoning as toggleAddMode's own opportunity-mode check.
  toggleFreehandMode(): void {
    if (this.freehandMode) {
      this.setFreehandMode(false);
      return;
    }
    this.addMode = false;
    this.addBrokerageMode = false;
    this.clearPendingLocation();
    this.closeOpportunityPicker();
    this.showPoiChecklist.set(false);
    this.setFreehandMode(true);
    // Same toast treatment as selectOpportunityCategory's own hint — was a persistent toolbar
    // paragraph before, which (like that hint) only ever needed to say it once.
    this.notification.info('map.freehandHint');
  }

  private setFreehandMode(active: boolean): void {
    this.freehandMode = active;
    if (!this.map) return;

    if (active) {
      this.clearFreehandShape();
      // Panning would otherwise fight with tracing a shape — the map stays fixed while a shape
      // is being drawn, same as how a drawing tool in any other mapping app locks the canvas.
      this.map.setOptions({ draggable: false });
      this.attachFreehandListeners();
    } else {
      this.detachFreehandListeners();
      this.map.setOptions({ draggable: true });
      this.freehandPolyline?.setMap(null);
      this.freehandPolyline = undefined;
      this.freehandPath = [];
    }
  }

  // mousedown/mousemove/mouseup (not drag/dragstart/dragend, which don't fire while the map
  // itself is non-draggable) trace the path for as long as the button/finger stays down — the
  // Maps JS API maps touch gestures onto these same mouse events, so this works on mobile too.
  // Left outside zone.run: these fire continuously while drawing and only touch plain fields plus
  // the overlay's own path, none of which are template-bound, so there's nothing for Angular's
  // change detection to do here on every point — only the final shape (finishFreehandShape) needs
  // zone.run, since that's what flips freehandMode/freehandShape back to a bound state.
  private attachFreehandListeners(): void {
    if (!this.map) return;
    const map = this.map;

    this.freehandListeners.push(
      map.addListener('mousedown', (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        this.freehandDrawing = true;
        this.freehandPath = [event.latLng];
        this.freehandPolyline?.setMap(null);
        this.freehandPolyline = new google.maps.Polyline({
          map,
          path: this.freehandPath,
          strokeColor: '#000000',
          strokeWeight: 2,
          clickable: false
        });
      }),
      map.addListener('mousemove', (event: google.maps.MapMouseEvent) => {
        if (!this.freehandDrawing || !event.latLng) return;
        this.freehandPath.push(event.latLng);
        this.freehandPolyline?.setPath(this.freehandPath);
      }),
      map.addListener('mouseup', () => {
        if (!this.freehandDrawing) return;
        this.zone.run(() => this.finishFreehandShape());
      })
    );
  }

  private detachFreehandListeners(): void {
    this.freehandListeners.forEach((listener) => listener.remove());
    this.freehandListeners.length = 0;
    this.freehandDrawing = false;
  }

  private finishFreehandShape(): void {
    const path = this.freehandPath;
    this.freehandDrawing = false;
    this.freehandPolyline?.setMap(null);
    this.freehandPolyline = undefined;
    this.freehandPath = [];

    // A stray click (mousedown immediately followed by mouseup, no drag in between) isn't a
    // shape — stay armed so the visitor can just try again instead of silently doing nothing.
    if (path.length < 3) return;

    const polygon = new google.maps.Polygon({
      map: this.map,
      paths: path,
      fillColor: '#000000',
      fillOpacity: 0.12,
      strokeColor: '#000000',
      strokeWeight: 2,
      clickable: false
    });
    this.freehandShape.set(polygon);
    this.setFreehandMode(false);
  }

  // Backs the result badge's "clear" button, shown while a shape is active (see the template).
  clearFreehandShape(): void {
    this.freehandShape()?.setMap(null);
    this.freehandShape.set(null);
    // A CMA panel open against a shape that's being discarded would otherwise be left pointing
    // at an area that's no longer drawn on the map.
    this.cmaResult.set(null);
  }

  // Backs the freehand result badge's "Market analysis" button — reuses the same drawn shape
  // visibleListings already scopes the card results to, sent to the backend instead of filtered
  // client-side: this.listingService.listings() only holds the ~100 most recently created
  // listings site-wide (see its own refresh() comment), nowhere near reliable for "every active
  // listing in this specific area."
  openCma(): void {
    const shape = this.freehandShape();
    if (!shape) return;

    const points = shape
      .getPath()
      .getArray()
      .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));

    this.loadingCma.set(true);
    this.listingService.getCma(points).subscribe({
      next: (result) => {
        this.loadingCma.set(false);
        this.cmaResult.set(result);
      },
      error: () => {
        this.loadingCma.set(false);
        this.notification.error('map.cmaError');
      }
    });
  }

  closeCma(): void {
    this.cmaResult.set(null);
  }

  // Backs the floating confirmation card's "Cancelar" button — same cleanup as toggling
  // add-mode off, exposed separately so the card doesn't have to know about that toggle. Covers
  // both addMode and addBrokerageMode since the same confirmation card serves either one.
  cancelAddMode(): void {
    this.addMode = false;
    this.addBrokerageMode = false;
    this.clearPendingLocation();
  }

  private clearPendingLocation(): void {
    this.selectedLat = null;
    this.selectedLng = null;
    this.marker?.setMap(null);
    this.marker = undefined;
  }

  // Toggles the category-picker panel, mirroring togglePoiChecklist. Closing it while a category
  // is active also stops click-to-analyze mode — closing the tool reads as "I'm done with this,"
  // so leaving the map silently still in analyze mode after would be surprising.
  toggleOpportunityChecklist(): void {
    if (this.showOpportunityChecklist()) {
      this.closeOpportunityPicker();
      return;
    }
    this.showOpportunityChecklist.set(true);
    // Both picker panels are positioned near the same corner of the toolbar — having both
    // open at once visually overlaps them, so opening one closes the other.
    this.showPoiChecklist.set(false);
    this.resetSheetCollapse();
  }

  selectOpportunityCategory(key: OpportunityCategoryKey): void {
    this.selectedOpportunityCategory.set(key);
    this.opportunityMode = true;
    // Mutually exclusive with add-property mode, add-brokerage mode, and freehand drawing — all
    // interpret a map click differently, so leaving more than one on at once would make a
    // click's effect ambiguous.
    this.addMode = false;
    this.addBrokerageMode = false;
    if (this.freehandMode) {
      this.setFreehandMode(false);
    }

    // A radius is already on the map (an earlier category was analyzed at some point) — switching
    // categories re-runs the analysis right there instead of asking the visitor to click the map
    // again for the exact same spot. Only when nothing's been analyzed yet does this still need a
    // click, so that's the only time the hint toast below applies.
    const center = this.opportunityCircle?.getCenter();
    if (center) {
      this.analyzeOpportunity(center);
      return;
    }

    // A toast, not a persistent toolbar banner — same instruction either way ("click the map to
    // analyze that spot"), but a toast can't shift any other button's position the way the old
    // inline banner did (see the two fixes for map-opportunity-btn's position above).
    this.notification.info('map.clickToAnalyze');
  }

  confirmLocation(): void {
    if (this.selectedLat === null || this.selectedLng === null) return;

    const destination = this.addBrokerageMode ? '/inmobiliarias/new' : '/listings/new';
    this.router.navigate([destination], {
      queryParams: { lat: this.selectedLat, lng: this.selectedLng }
    });
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.syncSearchMunicipality(term);
    // Typing again means whatever searchAddress() last found no longer matches this query —
    // drop it rather than leaving a stale pin from the previous search sitting on the map.
    this.searchResultMarker?.setMap(null);
    this.searchResultMarker = undefined;
  }

  // If the typed term exactly matches a municipality name (accent/case-insensitive), fetches its
  // shape so filteredListings' matchesTerm can widen to include listings geometrically inside it
  // — see the comment on searchMunicipalityPolygon. Only fires on an exact match (not on every
  // partial keystroke) so it doesn't flood the backend with lookups, or guess between ambiguous
  // partial matches, while the visitor is still typing.
  private syncSearchMunicipality(term: string): void {
    const normalizedTerm = normalizeText(term);
    const match = normalizedTerm
      ? this.municipalities().find((m) => normalizeText(m.name) === normalizedTerm)
      : undefined;

    if (!match) {
      this.searchMunicipalityRequestId++;
      this.searchMunicipalityCvegeo = null;
      this.searchMunicipalityPolygon()?.setMap(null);
      this.searchMunicipalityPolygon.set(null);
      return;
    }

    if (match.cvegeo === this.searchMunicipalityCvegeo) return; // already have (or are fetching) this one

    const requestId = ++this.searchMunicipalityRequestId;
    this.searchMunicipalityCvegeo = match.cvegeo;

    this.geomarketingService.getMunicipalityBoundary(match.cvegeo).subscribe({
      next: (result) => {
        // The visitor may have kept typing (or cleared the box) while this was in flight — only
        // apply a response that's still for the currently-matched municipality.
        if (requestId !== this.searchMunicipalityRequestId) return;

        const paths = this.geoJsonToPaths(result.boundary);
        this.searchMunicipalityPolygon()?.setMap(null);
        this.searchMunicipalityPolygon.set(this.buildMunicipalityPolygon(paths));
        this.fitBoundsToPaths(paths);
      },
      // Silently give up rather than toast — unlike the dropdown, this fires implicitly while
      // typing, not from a deliberate click, so a failed lookup shouldn't interrupt the visitor.
      // The plain text search (matchesTerm's first three conditions) still applies either way.
      error: () => {
        if (requestId !== this.searchMunicipalityRequestId) return;
        this.searchMunicipalityCvegeo = null;
      }
    });
  }

  // Triggered on Enter (not on every keystroke, unlike onSearchChange/syncSearchMunicipality) —
  // geocoding is a billed Google API call, so it only fires on a deliberate "search" action.
  // Lets the main search box find a real address even when zero listings match it: typed text
  // first filters existing listings client-side (via filteredListings, already live by the time
  // this runs) and, independently, tries to resolve it as an address so the map still moves
  // there. An exact municipality-name match is already handled by syncSearchMunicipality's own
  // panTo, so this skips geocoding in that case rather than re-centering on the same spot twice.
  searchAddress(): void {
    const query = this.search().trim();
    if (!query || this.searchMunicipalityCvegeo || !this.map) return;

    // A typed/pasted coordinate pair (DMS like 20°42'17.7"N 102°26'38.5"W, or plain decimal
    // "lat,lng") already tells us exactly where to go — skip the Geocoder (which doesn't
    // reliably parse the DMS form anyway) and pan straight there.
    const coordinates = parseCoordinates(query);
    if (coordinates) {
      this.map.panTo(coordinates);
      this.map.setZoom(16);
      this.placeSearchResultMarker(coordinates);
      return;
    }

    new google.maps.Geocoder().geocode(
      { address: query, componentRestrictions: { country: 'mx' } },
      (results, status) => {
        // The Maps JS SDK invokes this callback outside Angular's zone — wrapped in zone.run,
        // same as every other Maps callback in this component, so the state changes below
        // actually trigger change detection (the notification toast in particular).
        this.zone.run(() => {
          if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
            // Silent unless the text search also came up empty — a failed geocode for, say, a
            // listing title that isn't a real address shouldn't contradict the results already
            // showing on screen.
            if (this.filteredListings().length === 0) {
              this.notification.error('map.addressNotFoundError');
            }
            return;
          }

          const location = results[0].geometry.location;
          this.map?.panTo(location);
          this.map?.setZoom(16);
          this.placeSearchResultMarker({ lat: location.lat(), lng: location.lng() });
        });
      }
    );
  }

  // Only when nothing already marks this spot: a text search that also matched real listings
  // already shows their own markers (see filteredListings/renderListingMarkers) — adding a
  // second, unrelated pin right next to one would just be visual noise. A pure address/
  // coordinate search with zero listing matches has nothing on the map yet, so this is the only
  // thing that tells the visitor where their search actually landed.
  private placeSearchResultMarker(location: google.maps.LatLngLiteral): void {
    if (this.filteredListings().length > 0) return;

    if (this.searchResultMarker) {
      this.searchResultMarker.setPosition(location);
    } else {
      this.searchResultMarker = new google.maps.Marker({ position: location, map: this.map });
    }
  }

  setTypeFilter(type: ListingType | 'all'): void {
    this.typeFilter.set(type);
  }

  setPropertyTypeFilter(propertyType: PropertyType | 'all'): void {
    this.propertyTypeFilter.set(propertyType);
  }

  setMinPrice(target: HTMLInputElement): void {
    const digits = applyCurrencyMask(target);
    this.minPrice.set(digits === '' ? null : Number(digits));
  }

  setMaxPrice(target: HTMLInputElement): void {
    const digits = applyCurrencyMask(target);
    this.maxPrice.set(digits === '' ? null : Number(digits));
  }

  setMinBeds(value: string): void {
    this.minBeds.set(value === 'any' ? 'any' : Number(value));
  }

  setMinBaths(value: string): void {
    this.minBaths.set(value === 'any' ? 'any' : Number(value));
  }

  setCompanyFilter(term: string): void {
    this.companyFilter.set(term);
  }

  // GeoJSON coordinates are [lng, lat] pairs (opposite order from LatLngLiteral), one ring deeper
  // for MultiPolygon than Polygon — google.maps.Polygon's `paths` takes an array of rings either
  // way, so both cases flatten to the same shape here (a MultiPolygon's separate polygons are
  // just additional disjoint rings, which is exactly how Polygon already renders multiple rings).
  private geoJsonToPaths(geometry: GeoJsonGeometry): google.maps.LatLngLiteral[][] {
    const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
    return rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
  }

  // Shared styling for both municipality-boundary overlays (the dropdown's and the search box's)
  // — same gold outline, not clickable (neither is meant to intercept map clicks).
  private buildMunicipalityPolygon(paths: google.maps.LatLngLiteral[][]): google.maps.Polygon {
    return new google.maps.Polygon({
      paths,
      map: this.map,
      strokeColor: FRACCIONAMIENTO_CLUSTER_COLOR,
      strokeWeight: 2,
      fillColor: FRACCIONAMIENTO_CLUSTER_COLOR,
      fillOpacity: 0.08,
      clickable: false
    });
  }

  private fitBoundsToPaths(paths: google.maps.LatLngLiteral[][]): void {
    const bounds = new google.maps.LatLngBounds();
    paths.forEach((ring) => ring.forEach((point) => bounds.extend(point)));
    this.map?.fitBounds(bounds);
  }

  selectMunicipality(cvegeo: string): void {
    this.municipalityFilter.set(cvegeo);

    if (!cvegeo) {
      this.municipalityPolygon()?.setMap(null);
      this.municipalityPolygon.set(null);
      return;
    }

    this.geomarketingService.getMunicipalityBoundary(cvegeo).subscribe({
      next: (result) => {
        // The visitor may have already changed/cleared the selection while this was in flight —
        // only apply a response that's still for the currently-selected municipality.
        if (this.municipalityFilter() !== cvegeo) return;

        const paths = this.geoJsonToPaths(result.boundary);
        this.municipalityPolygon()?.setMap(null);
        this.municipalityPolygon.set(this.buildMunicipalityPolygon(paths));
        this.fitBoundsToPaths(paths);
      },
      error: () => {
        // Same staleness check as `next` — a superseded request's failure shouldn't toast an
        // error for a municipality the visitor already moved away from.
        if (this.municipalityFilter() !== cvegeo) return;
        this.notification.error('map.municipalityLoadError');
      }
    });
  }

  toggleAgebLayer(checked: boolean): void {
    this.showAgebLayer.set(checked);

    if (checked) {
      this.loadAgebsForCurrentBounds();
      return;
    }

    // Invalidate any in-flight fetch so a late response can't repopulate the layer right after
    // it was turned off, then drop every feature — cheaper than tearing down and recreating the
    // google.maps.Data instance on every toggle.
    this.agebRequestId++;
    this.agebDataLayer?.forEach((feature) => this.agebDataLayer!.remove(feature));
  }

  private loadAgebsForCurrentBounds(): void {
    const bounds = this.map?.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const requestId = ++this.agebRequestId;

    this.geomarketingService.agebsInBounds(sw.lat(), sw.lng(), ne.lat(), ne.lng()).subscribe({
      next: (agebs) => this.zone.run(() => {
        // A pan/zoom (or the layer being unchecked) while this was in flight already bumped
        // agebRequestId — a stale response repainting the layer would show AGEBs for a viewport
        // the visitor has since scrolled away from.
        if (requestId !== this.agebRequestId) return;
        this.renderAgebLayer(agebs);
      }),
      error: () => {
        if (requestId !== this.agebRequestId) return;
        this.notification.error('map.agebLoadError');
      }
    });
  }

  private renderAgebLayer(agebs: AgebBoundary[]): void {
    if (!this.map) return;

    if (!this.agebDataLayer) {
      this.agebDataLayer = new google.maps.Data({ map: this.map });
      this.agebDataLayer.setStyle((feature) => {
        const level = feature.getProperty('estimatedSocioeconomicLevel') as SocioeconomicLevel | null;
        const color = level ? SOCIOECONOMIC_LEVEL_COLORS[level] : AGEB_UNSCORED_COLOR;
        return { fillColor: color, fillOpacity: 0.35, strokeColor: color, strokeWeight: 1 };
      });
      this.agebDataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        this.zone.run(() => this.openAgebInfo(event));
      });
    }

    this.agebDataLayer.forEach((feature) => this.agebDataLayer!.remove(feature));
    for (const ageb of agebs) {
      this.agebDataLayer.addGeoJson({
        type: 'Feature',
        geometry: ageb.boundary,
        properties: { cvegeo: ageb.cvegeo, estimatedSocioeconomicLevel: ageb.estimatedSocioeconomicLevel }
      });
    }
  }

  // One-shot, caller-triggered fetch for the opt-in competitor-density layer — unlike
  // showAgebLayer's own loadAgebsForCurrentBounds, this does NOT refetch on every pan/zoom (see
  // GeomarketingController.GetCompetitorDensity's own reasoning: each AGEB costs a DENUE call,
  // so an automatic on-pan layer here would spend that budget far faster than the plain
  // socioeconomic layer does). Requires a selected opportunity category, since the competitor
  // count is always for one specific business type.
  loadCompetitorDensity(): void {
    if (!this.map) return;
    const categoryKey = this.selectedOpportunityCategory();
    if (!categoryKey) return;
    const config = OPPORTUNITY_CATEGORIES.find((c) => c.key === categoryKey)!;
    const bounds = this.map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    this.loadingCompetitorDensity.set(true);
    this.geomarketingService
      .competitorDensity(config.denueSearchTerm, config.radiusMeters, sw.lat(), sw.lng(), ne.lat(), ne.lng())
      .subscribe({
        next: (agebs) =>
          this.zone.run(() => {
            this.loadingCompetitorDensity.set(false);
            this.competitorDensityActive.set(true);
            this.renderCompetitorDensityLayer(agebs, config.goodMaxCount, config.moderateMaxCount);
          }),
        error: (err: { status?: number }) =>
          this.zone.run(() => {
            this.loadingCompetitorDensity.set(false);
            this.notification.error(err?.status === 400 ? 'map.competitorDensityTooManyZones' : 'map.competitorDensityError');
          })
      });
  }

  clearCompetitorDensity(): void {
    this.competitorDensityActive.set(false);
    this.competitorDensityLayer?.forEach((feature) => this.competitorDensityLayer!.remove(feature));
  }

  private renderCompetitorDensityLayer(agebs: AgebCompetitorDensity[], goodMaxCount: number, moderateMaxCount: number): void {
    if (!this.map) return;

    if (!this.competitorDensityLayer) {
      this.competitorDensityLayer = new google.maps.Data({ map: this.map });
      this.competitorDensityLayer.setStyle((feature) => {
        const count = feature.getProperty('competitorCount') as number | null;
        const color =
          count === null ? AGEB_UNSCORED_COLOR : count <= goodMaxCount ? '#15803d' : count <= moderateMaxCount ? '#b45309' : '#b91c1c';
        return { fillColor: color, fillOpacity: 0.45, strokeColor: color, strokeWeight: 1 };
      });
      this.competitorDensityLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        this.zone.run(() => {
          if (!this.infoWindow || !event.latLng) return;
          const count = event.feature.getProperty('competitorCount') as number | null;
          const content =
            count === null
              ? this.translation.t('map.competitorDensityUnavailable')
              : this.translation.t('map.competitorDensityCount', { count: String(count) });
          this.infoWindow.setContent(`<div>${content}</div>`);
          this.infoWindow.setPosition(event.latLng);
          this.infoWindow.open(this.map);
        });
      });
    }

    this.competitorDensityLayer.forEach((feature) => this.competitorDensityLayer!.remove(feature));
    for (const ageb of agebs) {
      this.competitorDensityLayer.addGeoJson({
        type: 'Feature',
        geometry: ageb.boundary,
        properties: { cvegeo: ageb.cvegeo, competitorCount: ageb.competitorCount }
      });
    }
  }

  // Reuses the same population-density lookup and popup content shape as the opportunity tool's
  // drawOpportunityCircle (see SOCIOECONOMIC_LEVEL_LABEL_KEYS and the map.opportunity* i18n
  // keys) — an AGEB click is asking the same question ("what's the density/level here?"), just
  // triggered by clicking a shaded zone instead of running a business-count analysis first.
  private openAgebInfo(event: google.maps.Data.MouseEvent): void {
    if (!this.infoWindow || !event.latLng) return;
    const requestId = ++this.infoWindowGeneration;
    this.infoWindowShowsOpportunity = false;

    const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    firstValueFrom(this.geomarketingService.populationDensity(position.lat, position.lng))
      .catch(() => null)
      .then((population) => {
        if (!population || requestId !== this.infoWindowGeneration) return;

        const densityLine = this.translation.t('map.opportunityPopulationDensity', {
          density: Math.round(population.densityPerSqKm).toLocaleString(),
          year: population.censusYear
        });
        const levelKey = population.estimatedSocioeconomicLevel
          ? SOCIOECONOMIC_LEVEL_LABEL_KEYS[population.estimatedSocioeconomicLevel]
          : null;
        const levelLine = levelKey
          ? `<br>${this.translation.t('map.opportunitySocioeconomicLevel', { level: this.translation.t(levelKey) })}`
          : '';

        this.infoWindow!.setContent(`<div class="opportunity-info">${densityLine}${levelLine}</div>`);
        this.infoWindow!.setPosition(position);
        this.infoWindow!.open(this.map);
      });
  }

  toggleSaveSearchForm(): void {
    this.showSaveSearchForm.update((v) => !v);
  }

  setSaveSearchName(name: string): void {
    this.saveSearchName.set(name);
  }

  saveCurrentSearch(): void {
    const name = this.saveSearchName().trim();
    if (!name) return;

    const type = this.typeFilter();
    const propertyType = this.propertyTypeFilter();
    const minBd = this.minBeds();
    const minBa = this.minBaths();

    this.savedSearchService
      .create({
        name,
        listingType: type === 'all' ? undefined : type,
        propertyType: propertyType === 'all' ? undefined : propertyType,
        minPrice: this.minPrice() ?? undefined,
        maxPrice: this.maxPrice() ?? undefined,
        minBedrooms: minBd === 'any' ? undefined : minBd,
        minBathrooms: minBa === 'any' ? undefined : minBa
      })
      .subscribe({
        next: () => {
          this.notification.success('savedSearches.saved');
          this.saveSearchName.set('');
          this.showSaveSearchForm.set(false);
        },
        error: () => this.notification.error('savedSearches.saveError')
      });
  }

  toggleMoreFilters(): void {
    this.showMoreFilters.update((v) => !v);
  }

  setMobileView(view: 'map' | 'results'): void {
    this.mobileView.set(view);

    // The map pane is toggled with plain CSS display:none (not *ngIf) so the map instance and
    // its markers survive switching tabs — but Google Maps reads its container's size once,
    // when told to, not on every reflow. A container that was display:none (0×0) when the map
    // was first built, or during the time it was hidden, leaves the map stuck at that stale
    // size — visible as grey tiles or a map that doesn't fill its pane — until something tells
    // it to re-measure. google.maps.event.trigger(..., 'resize') is exactly that, and panning
    // back to the last known center after it keeps the viewport from drifting when the resize
    // itself shifts what's visible.
    if (view === 'map' && this.map) {
      const center = this.map.getCenter();
      google.maps.event.trigger(this.map, 'resize');
      if (center) this.map.setCenter(center);
    }
  }

  openMobileFilters(): void {
    this.mobileFiltersOpen.set(true);
  }

  closeMobileFilters(): void {
    this.mobileFiltersOpen.set(false);
  }

  // "Aplicar filtros" on the mobile filters page — the fields already apply live (same signals
  // the desktop inline filters write to), so this just takes the visitor back to their results.
  applyMobileFilters(): void {
    this.mobileFiltersOpen.set(false);
  }

  resetFilters(): void {
    this.typeFilter.set('sale');
    this.propertyTypeFilter.set('all');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.minBeds.set('any');
    this.minBaths.set('any');
    this.companyFilter.set('');
    this.selectMunicipality('');
    this.clearFreehandShape();

    // The price inputs are deliberately uncontrolled (see applyCurrencyMask's own comment on
    // caret handling), so clearing minPrice/maxPrice above doesn't touch their displayed text —
    // done here directly instead. Both the desktop inline filters and the mobile filters page
    // render their own copy of these fields, so this clears whichever is currently in the DOM.
    document.querySelectorAll<HTMLInputElement>('.price-input').forEach((input) => (input.value = ''));
  }

  toggleFavorite(listingId: string): void {
    this.favorites.toggle(listingId);
  }

  toggleCompare(listingId: string): void {
    this.comparison.toggle(listingId);
  }

  onCardHover(listingId: string): void {
    this.listingMarkers.get(listingId)?.setAnimation(google.maps.Animation.BOUNCE);
  }

  onCardLeave(listingId: string): void {
    this.listingMarkers.get(listingId)?.setAnimation(null);
  }
}
