import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ListingService } from '../../../core/services/listing.service';
import { AuthService } from '../../../core/services/auth.service';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { Agency } from '../../../core/models/agency.model';
import { GeomarketingService, MunicipalityListItem, StateListItem } from '../../../core/services/geomarketing.service';
import { LandUseCategoryService } from '../../../core/services/land-use-category.service';
import {
  CardinalOrientationType,
  Currency,
  ConstructionConditionType,
  LandTenureType,
  ListingInput,
  LotShapeType,
  PROPERTY_TYPE_OPTIONS,
  PropertyType,
  TopographyType,
  VialidadType,
  isHouseOrApartmentPropertyType,
  isLandOrCommercialPropertyType,
  isPureLandPropertyType
} from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorReportingService } from '../../../core/services/error-reporting.service';
import { amountToWords } from '../../../shared/utils/amount-to-words';
import { normalizeText } from '../../../shared/utils/normalize-text';
import { CurrencyInputDirective } from '../../../shared/directives/currency-input.directive';
import { ZipInputDirective } from '../../../shared/directives/zip-input.directive';
import { MortgageCalculatorComponent } from '../../../shared/components/mortgage-calculator/mortgage-calculator.component';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { ListingQuotaComponent } from '../../../shared/components/listing-quota/listing-quota.component';
import { SeoService } from '../../../core/services/seo.service';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';

// Mirrors PhotoUploadService's server-side limits exactly, so a bad file is rejected the
// moment it's picked instead of after a wasted upload round-trip.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_LISTING = 20;

// Returns a new array with the item at fromIndex relocated to toIndex — used by the photo
// gallery's drag-to-reorder and "Hacer principal" button (see reorderImages).
function moveItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const copy = array.slice();
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

// Cheap client-side gate before autofillFromDraft() ever calls the (paid, per-request) AI
// parsing endpoint — a pasted text with neither an area nor a price in it almost certainly isn't
// a real listing ad, so there's nothing useful for the model to extract and the request is
// skipped entirely rather than spending a call to confirm that. Deliberately loose: a false
// negative here (blocking a real ad) is worse than a false positive (letting a borderline text
// through, which the backend's own prompt already handles safely for free) — so this only needs
// ONE of area/price to match to let the request proceed.
// "\d\s*m\b" needs a word boundary right after the "m" so "3 meses"/"5 pm" don't match (the next
// letter keeps "m" from being a word boundary), while "72.50m" and "112 metros" do (space/EOL
// right after "m").
const DRAFT_AREA_HINT_PATTERN = /\d\s*m\b|\d\s*m²|\d\s*m2\b|metros\s*cuadrados?/i;
const DRAFT_PRICE_HINT_PATTERN = /\$\s*\d|\d\s*(mxn|usd|pesos|d[oó]lares)\b|precio|valor\s*(de\s*)?(venta|renta)/i;

// Blank/whitespace-only counts as "not entered" (matches the trim-and-clear treatment at
// submit time) rather than a pattern mismatch — only an actually-typed value gets validated.
function optionalUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  return /^https?:\/\/\S+$/i.test(value) ? null : { pattern: true };
}

@Component({
  selector: 'app-listing-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, CurrencyInputDirective, ZipInputDirective, MortgageCalculatorComponent, FormErrorComponent, ListingQuotaComponent],
  templateUrl: './listing-form.component.html',
  styleUrl: './listing-form.component.css'
})
export class ListingFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly auth = inject(AuthService);
  private readonly brokerageService = inject(BrokerageService);
  private readonly geomarketingService = inject(GeomarketingService);
  private readonly landUseCategoryService = inject(LandUseCategoryService);
  protected readonly translation = inject(TranslationService);
  private readonly notification = inject(NotificationService);
  private readonly errorReporting = inject(ErrorReportingService);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  private readonly editingId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = this.editingId !== null;

  readonly lat: number | null = this.parseCoordinate(this.route.snapshot.queryParamMap.get('lat'));
  readonly lng: number | null = this.parseCoordinate(this.route.snapshot.queryParamMap.get('lng'));
  readonly currentYear = new Date().getFullYear();
  readonly propertyTypeOptions = PROPERTY_TYPE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    priceOnRequest: [false],
    currency: ['MXN' as Currency, Validators.required],
    type: ['sale' as 'rent' | 'sale', Validators.required],
    propertyType: ['house' as PropertyType, Validators.required],
    street: ['', Validators.required],
    // Not required: every listing that existed before this field split has colonia/zipCode
    // blank (colonia didn't exist as a concept yet; zipCode was never actually collected) — a
    // required validator here would permanently block editing any of them until an owner
    // happens to notice and fill in fields the listing never had. city/state stay required
    // since every listing has always had a real value for those.
    colonia: [''],
    // city/state are dropdowns backed by the real INEGI municipality catalog already imported
    // for the map's geomarketing feature (see municipalities/statesInCatalog/citiesForState
    // below) — not free text, so a listing's location always matches a real place.
    city: ['', Validators.required],
    state: ['Puebla', Validators.required],
    zipCode: ['', [Validators.minLength(5), Validators.maxLength(5)]],
    // Locked to México: every listing in this app is Mexican real estate today, and there's no
    // second country's worth of state/city catalog data to offer as alternatives yet. disabled
    // controls still submit their value via form.getRawValue() (see submit() below).
    country: [{ value: 'México', disabled: true }],
    // Not required: for a land/commercial listing these fields are hidden (see
    // isLandOrCommercial()) and submitted as 0 regardless of whatever value sits in the
    // control — a required validator here could otherwise leave the form permanently
    // unsubmittable if the user clears one of these fields, then switches to a type where
    // it's hidden and has no way to fix the now-invalid, now-invisible control.
    bedrooms: [1, Validators.min(0)],
    bathrooms: [1, Validators.min(0)],
    areaSqm: [0, [Validators.required, Validators.min(0)]],
    yearBuilt: this.fb.control<number | null>(null, [Validators.min(1800), Validators.max(this.currentYear)]),
    parkingSpaces: this.fb.control<number | null>(null, Validators.min(0)),
    parkingIsCovered: this.fb.control<boolean | null>(null),
    floors: this.fb.control<number | null>(null, Validators.min(0)),
    lotSizeSqm: this.fb.control<number | null>(null, Validators.min(0)),
    gardenSizeSqm: this.fb.control<number | null>(null, Validators.min(0)),
    hasHeatingCooling: [false],
    hasRoofGarden: [false],
    hoaFee: this.fb.control<number | null>(null, Validators.min(0)),
    videoTourUrl: ['', optionalUrlValidator],
    constructionCondition: this.fb.control<ConstructionConditionType | null>(null),
    facadeOrientation: this.fb.control<CardinalOrientationType | null>(null),
    hasNaturalGas: this.fb.control<boolean | null>(null),
    hasLpGas: this.fb.control<boolean | null>(null),
    hasCistern: this.fb.control<boolean | null>(null),
    // Only shown/relevant once hasCistern is checked (see the template) — not reset to null when
    // hidden, same reasoning as every other conditionally-shown field here: the owner's already-
    // entered value survives toggling the checkbox off and back on.
    cisternCapacityLiters: this.fb.control<number | null>(null, Validators.min(0)),
    // Hidden/disabled for apartments (see isWellAvailable()) — not reset to null when hidden,
    // same reasoning as the isLandOrCommercial()-gated fields above: switching away and back
    // shouldn't lose what the visitor already entered.
    hasWell: this.fb.control<boolean | null>(null),
    // Also defaulted to checked, same reasoning as hasPotableWater/hasDrainage above.
    hasKitchen: this.fb.control<boolean | null>(true),
    hasLivingRoom: this.fb.control<boolean | null>(true),
    hasDiningRoom: this.fb.control<boolean | null>(true),
    hasPool: this.fb.control<boolean | null>(null),
    hasTerrace: this.fb.control<boolean | null>(null),
    hasBalcony: this.fb.control<boolean | null>(null),
    hasServiceRoom: this.fb.control<boolean | null>(null),
    hasLaundryArea: this.fb.control<boolean | null>(null),
    hasStorageRoom: this.fb.control<boolean | null>(null),
    hasGym: this.fb.control<boolean | null>(null),
    hasSecurity: this.fb.control<boolean | null>(null),
    hasElevator: this.fb.control<boolean | null>(null),
    hasBbqArea: this.fb.control<boolean | null>(null),
    landUseZoning: this.fb.control<string | null>(null),
    landUseCategoryId: this.fb.control<number | null>(null),
    landTenure: this.fb.control<LandTenureType | null>(null),
    hasEjidalCertificate: this.fb.control<boolean | null>(null),
    // max(20) is a generous ceiling, not a strict zoning rule — COS/CUS values stay well under
    // that in practice (CUS, the higher of the two, rarely exceeds single digits even for
    // dense multi-story zoning); it exists only to catch an obvious data-entry slip like typing
    // "150" meaning 1.50, not to enforce a real urban-planning limit this app has no authority over.
    cosCoefficient: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(20)]),
    cusCoefficient: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(20)]),
    maxHeightMeters: this.fb.control<number | null>(null, Validators.min(0)),
    isFreeOfLiens: this.fb.control<boolean | null>(null),
    hasPropertyTaxDebt: this.fb.control<boolean | null>(null),
    hasWaterDebt: this.fb.control<boolean | null>(null),
    frontageWidthMeters: this.fb.control<number | null>(null, Validators.min(0)),
    frontageDepthMeters: this.fb.control<number | null>(null, Validators.min(0)),
    commercialUnitCount: this.fb.control<number | null>(null, Validators.min(0)),
    hasApartmentUnit: this.fb.control<boolean | null>(null),
    // Defaults to checked: most houses/apartments in this market do have potable water and
    // drainage, so defaulting to true (instead of unchecked/unknown) saves the common case a
    // click — an owner publishing a lot/land listing without either still unchecks these by hand.
    hasPotableWater: this.fb.control<boolean | null>(true),
    hasDrainage: this.fb.control<boolean | null>(true),
    // Also defaulted to checked, same reasoning as hasPotableWater/hasDrainage above.
    hasElectricity: this.fb.control<boolean | null>(true),
    hasThreePhaseElectricity: this.fb.control<boolean | null>(null),
    hasTelecomService: this.fb.control<boolean | null>(null),
    hasVehicleAccess: this.fb.control<boolean | null>(null),
    hasPavedStreet: this.fb.control<boolean | null>(null),
    hasNearbyUTurn: this.fb.control<boolean | null>(null),
    isCornerLot: this.fb.control<boolean | null>(null),
    streetFrontageCount: this.fb.control<number | null>(null, Validators.min(0)),
    primaryVialidadType: this.fb.control<VialidadType | null>(null),
    lotShape: this.fb.control<LotShapeType | null>(null),
    topography: this.fb.control<TopographyType | null>(null),
    isFloodRiskZone: this.fb.control<boolean | null>(null),
    cadastralValue: this.fb.control<number | null>(null, Validators.min(0)),
    // Hidden entirely when myAgencies() is empty (independent agent, or none picked at
    // signup) — see the template. Populated from brokerageService.fetchMine() in the
    // constructor below.
    brokerageId: this.fb.control<number | null>(null)
  });

  // The agent's own agencies, for the "publicar bajo" selector — empty for an independent
  // agent, in which case the template hides the field entirely and brokerageId stays null.
  readonly myAgencies = signal<Agency[]>([]);

  // A convenience input, not a real field: the backend only stores total price, so this is kept
  // outside `form` (never part of raw/getRawValue(), never submitted) and synced bidirectionally
  // with price/areaSqm instead — see the constructor's subscriptions below.
  readonly pricePerSqmControl = new FormControl<number | null>(null, Validators.min(0));
  // Set while one side of the price/areaSqm ↔ pricePerSqm sync is writing to the other, so that
  // write's own valueChanges doesn't bounce straight back and fight over rounding, or spin into
  // an infinite loop between the two subscriptions.
  private syncingPricePerSqm = false;

  // "Paste a classified ad, autofill the form" — also outside `form`, same reasoning as
  // pricePerSqmControl above: this is scratch input for autofillFromDraft() below, never
  // submitted itself.
  readonly draftText = new FormControl<string>('', { nonNullable: true });
  readonly parsingDraft = signal(false);

  // Admin-only section (ListingsController.UpdateOwnerContact) for swapping the listing-detail
  // contact card from the agent who posted it to the real property owner's own free-text info —
  // only an Admin ever sees this, and only once editing an existing listing (there's nothing to
  // hide/replace on a listing that doesn't exist yet).
  readonly isAdmin = computed(() => this.auth.currentUser()?.roles.includes('Admin') ?? false);
  // Defaults to true so a non-admin editing their own listing (the common case) never has to wait
  // on the fetchById() below before the regular form fields are usable; only matters once isAdmin
  // is also true (see template), to tell an admin editing someone else's listing apart from an
  // admin-who-is-also-the-owner.
  readonly isOwnListing = signal(true);

  // An admin who opened a listing they don't themselves own (the only way to reach this form
  // without being its owner — see listing-detail's edit link, shown only to admins) gets just the
  // owner-contact section below; everyone else gets the regular form, with that section appended
  // for an admin who also happens to own the listing.
  readonly showMainForm = computed(() => !this.isEditMode || this.isOwnListing());
  readonly showOwnerContactSection = computed(() => this.isEditMode && this.isAdmin());

  readonly ownerContactForm = this.fb.nonNullable.group({
    hideAgentContact: [false],
    ownerContactName: [''],
    ownerContactPhone: [''],
    ownerContactEmail: ['', [Validators.email]]
  });

  // True from the moment the owner-contact section's own save button fires until it resolves —
  // separate from isSubmitting below since an admin-but-not-owner only ever submits this one.
  readonly isSavingOwnerContact = signal(false);

  // Already-hosted photos (pasted URLs, or S3 URLs kept from a previous edit) vs. newly
  // picked files that still need uploading — kept separate so submit() can send the raw
  // File objects to the backend instead of a base64 string. previewUrl is a local
  // FileReader-generated data URL used ONLY for display, never sent to the backend.
  readonly existingImageUrls = signal<string[]>([]);
  readonly newPhotos = signal<{ file: File; previewUrl: string }[]>([]);

  // True from the moment submit() fires the create/update request until it resolves (success or
  // error) — drives the submit button's disabled/loading state and guards against a double
  // click firing the request twice while the first one (photo upload + save) is still in flight.
  readonly isSubmitting = signal(false);

  // State/City are free-text inputs with a <datalist> of suggestions, not strict <select>s — the
  // user can type to filter instead of scrolling a long list (see the template). States comes
  // from the full 32-state catalog (static reference data, real regardless of city coverage);
  // municipalities only has real city data imported for Puebla so far, so citiesForState is
  // matched against whatever the visitor actually typed in State, not constrained to it — a
  // state with no city catalog yet still lets them type a city name freely.
  // Root-scoped GeomarketingService fetches these once for the whole app — read its cached
  // signals directly instead of firing a second, redundant request here (same pattern as
  // landUseCategories below).
  readonly states = this.geomarketingService.states;
  readonly municipalities = this.geomarketingService.municipalities;
  readonly citiesForState = signal<MunicipalityListItem[]>([]);
  // Root-scoped LandUseCategoryService fetches this once for the whole app — read its cached
  // signal directly instead of firing a second, redundant request here.
  readonly landUseCategories = this.landUseCategoryService.categories;

  private existingLat: number | null = null;
  private existingLng: number | null = null;

  // Set from autofillFromDraft() when the pasted text's Google Maps link resolves to real
  // coordinates — takes priority over the map-click location (this.lat/this.lng) at submit time
  // since it's a more deliberate, named-source signal than wherever the owner happened to click
  // before reaching this form. this.lat/this.lng stay readonly (they're the route's own query
  // params), so this is a separate field rather than reassigning those.
  private draftLat: number | null = null;
  private draftLng: number | null = null;

  constructor() {
    inject(SeoService).set({
      title: this.isEditMode ? 'Editar propiedad' : 'Publicar propiedad',
      description: 'Publica o edita una propiedad en Espacial.com.mx.',
      path: this.editingId
        ? this.translation.path('listings', this.editingId, 'edit')
        : this.translation.path('listings', 'new')
    });

    // Recomputes whenever the shared municipalities signal (re)populates — covers both "data
    // was still loading when this component was created" and the steady-state case where it's
    // already cached from an earlier navigation. State-typed-by-hand is covered separately below
    // since it isn't a signal.
    effect(() => {
      this.citiesForState.set(this.filterCitiesByState(this.municipalities(), this.form.controls.state.value));
    });
    this.form.controls.state.valueChanges.subscribe((state) => {
      this.citiesForState.set(this.filterCitiesByState(this.municipalities(), state));
    });

    // Keeps pricePerSqmControl showing price ÷ area whenever price, areaSqm, or lotSizeSqm
    // changes — including the edit-mode patchValue(listing) below, and programmatic
    // setValue(price) elsewhere in this component (e.g. appCurrencyInput writing back a typed
    // price). lotSizeSqm only matters for pure land (see effectiveAreaForPricePerSqm's own
    // comment), but subscribing unconditionally is simpler than tearing this down/rebuilding it
    // every time propertyType changes, and costs nothing for a property type where it's ignored.
    this.form.controls.price.valueChanges.subscribe(() => this.syncPricePerSqmFromPrice());
    this.form.controls.areaSqm.valueChanges.subscribe(() => this.syncPricePerSqmFromPrice());
    this.form.controls.lotSizeSqm.valueChanges.subscribe(() => this.syncPricePerSqmFromPrice());
    // effectiveAreaForPricePerSqm()'s basis (areaSqm vs. lotSizeSqm) depends on propertyType —
    // without this, switching between a pure-land and a built property type would leave
    // pricePerSqmControl showing a stale value (computed against the old basis) until price or
    // either area control happened to change again.
    this.form.controls.propertyType.valueChanges.subscribe(() => this.syncPricePerSqmFromPrice());

    // Independent agents (0 agencies) never see the field at all (myAgencies().length === 0
    // in the template); an agent with exactly one agency gets it preselected since there's
    // nothing to actually choose — only 2+ forces a real decision. Skipped entirely in edit
    // mode: fetchById() below patches the control from the listing's own saved brokerageId
    // (possibly null, e.g. published before the agent joined this agency), and these two HTTP
    // calls have no ordering guarantee — auto-selecting here too could silently overwrite that
    // value with this agency's id if this response happens to land after patchValue().
    this.brokerageService.fetchMine().subscribe((agencies) => {
      this.myAgencies.set(agencies);
      if (!this.isEditMode && agencies.length === 1 && !this.form.controls.brokerageId.value) {
        this.form.controls.brokerageId.setValue(agencies[0].id);
      }
    });

    // The other direction: typing a price-per-m² computes and writes the total price. emitEvent
    // defaults to true here so the template (which reads form.value.price directly, not via an
    // async pipe) and anything else watching the price control pick up the change immediately;
    // syncingPricePerSqm above stops that price update from recomputing pricePerSqmControl right
    // back from itself.
    this.pricePerSqmControl.valueChanges.subscribe((pricePerSqm) => {
      if (this.syncingPricePerSqm) return;
      const area = this.effectiveAreaForPricePerSqm();
      if (pricePerSqm == null || !area) return;
      this.syncingPricePerSqm = true;
      this.form.controls.price.setValue(Math.round(pricePerSqm * area));
      this.syncingPricePerSqm = false;
    });

    // New listings start with zero photos on purpose — the "add at least one photo" check in
    // submit() forces a real upload/URL instead of silently shipping a stock placeholder that
    // looks like a saved photo once the listing is later reopened for editing.
    if (this.editingId) {
      this.listingService.fetchById(this.editingId).subscribe((listing) => {
        this.form.patchValue(listing);
        this.existingImageUrls.set(listing.imageUrls);
        this.existingLat = listing.lat ?? null;
        this.existingLng = listing.lng ?? null;
        this.isOwnListing.set(listing.ownerId === this.auth.currentUser()?.id);
        this.ownerContactForm.patchValue({
          hideAgentContact: listing.hideAgentContact,
          ownerContactName: listing.ownerContactName ?? '',
          ownerContactPhone: listing.ownerContactPhone ?? '',
          ownerContactEmail: listing.ownerContactEmail ?? ''
        });
      });
    } else if (this.lat !== null && this.lng !== null) {
      // Arriving here from the map's "Continue with this location" — best-effort autofill so
      // the owner doesn't have to retype an address the map already knows the coordinates of.
      // Never blocks or fails the form: every address field stays freely editable regardless of
      // whether (or how much of) this succeeds.
      this.reverseGeocodeAddress(this.lat, this.lng);
    }
  }

  private syncPricePerSqmFromPrice(): void {
    if (this.syncingPricePerSqm) return;
    const price = this.form.controls.price.value;
    const area = this.effectiveAreaForPricePerSqm();
    this.syncingPricePerSqm = true;
    this.pricePerSqmControl.setValue(area ? Math.round(price / area) : null, { emitEvent: false });
    this.syncingPricePerSqm = false;
  }

  // Raw land (isPureLand()) has no construction, so areaSqm ("Área de construcción") is normally
  // left at its default 0 there — the area that actually prices the property is lotSizeSqm
  // ("Área de terreno") instead. Reported bug: an owner filled in lotSizeSqm for a terreno
  // listing, typed a price per m², and nothing happened — the sync was unconditionally dividing
  // by areaSqm, which was still 0 for a lot with no building on it. Every other property type
  // keeps using areaSqm, same as before — a built property (house, retail space, office) prices
  // by its construction area, not its lot size.
  effectiveAreaForPricePerSqm(): number | null {
    // Reads the propertyType CONTROL's own value directly rather than calling isPureLand()
    // (which reads this.form.value.propertyType, the whole group's rolled-up value object).
    // That distinction matters here specifically: form.patchValue() in edit mode sets each
    // control with {onlySelf: true}, so the group's aggregate `.value` only refreshes once after
    // every control has been patched — not incrementally as each one lands. This method runs
    // synchronously from inside the areaSqm/lotSizeSqm valueChanges handlers DURING that patch,
    // so reading the aggregate here could still see the PRE-patch propertyType (e.g. "house")
    // even after the propertyType control itself already holds "land", silently picking the
    // wrong area and leaving pricePerSqmControl at null for a freshly opened land listing.
    const propertyType = this.form.controls.propertyType.value;
    return isPureLandPropertyType(propertyType) ? this.form.controls.lotSizeSqm.value : this.form.controls.areaSqm.value;
  }

  // "Pegar un anuncio y autocompletar" — meant to be used FIRST, before manually filling
  // anything else (see the hint text in the template): every matched field is overwritten
  // unconditionally, since on a blank /listings/new form there's no real data to lose yet.
  // ListingDraftParsingService (backend) only returns a field when the source text stated it
  // explicitly or it's a direct unit conversion, never a guess, so anything it leaves out here
  // is left exactly as the form already had it. description is set straight from the pasted
  // text itself (never sent through the AI) so the owner's own wording is never altered.
  autofillFromDraft(): void {
    const text = this.draftText.value.trim();
    if (!text) return;

    // Stops here — never reaches listingService.parseDraft() — when the text has neither an
    // area nor a price hint in it (see DRAFT_AREA_HINT_PATTERN/DRAFT_PRICE_HINT_PATTERN above),
    // so a clearly-not-an-ad paste doesn't spend an AI call just to come back empty.
    if (!DRAFT_AREA_HINT_PATTERN.test(text) && !DRAFT_PRICE_HINT_PATTERN.test(text)) {
      this.notification.error('listingForm.pasteAdMissingKeyInfo');
      return;
    }

    this.form.controls.description.setValue(text);
    this.parsingDraft.set(true);

    this.listingService
      .parseDraft(text)
      .pipe(finalize(() => this.parsingDraft.set(false)))
      .subscribe({
        next: (draft) => {
          if (draft.title) this.form.controls.title.setValue(draft.title);
          if (draft.listingType) this.form.controls.type.setValue(draft.listingType);
          if (draft.propertyType) this.form.controls.propertyType.setValue(draft.propertyType);
          if (draft.price != null) this.form.controls.price.setValue(draft.price);
          if (draft.currency) this.form.controls.currency.setValue(draft.currency);
          if (draft.colonia) this.form.controls.colonia.setValue(draft.colonia);
          if (draft.city) this.form.controls.city.setValue(draft.city);
          if (draft.state) this.form.controls.state.setValue(draft.state);
          if (draft.bedrooms != null) this.form.controls.bedrooms.setValue(draft.bedrooms);
          if (draft.bathrooms != null) this.form.controls.bathrooms.setValue(draft.bathrooms);
          if (draft.areaSqm != null) this.form.controls.areaSqm.setValue(draft.areaSqm);
          if (draft.lotSizeSqm != null) this.form.controls.lotSizeSqm.setValue(draft.lotSizeSqm);
          if (draft.frontageWidthMeters != null) this.form.controls.frontageWidthMeters.setValue(draft.frontageWidthMeters);
          if (draft.frontageDepthMeters != null) this.form.controls.frontageDepthMeters.setValue(draft.frontageDepthMeters);
          if (draft.gardenSizeSqm != null) this.form.controls.gardenSizeSqm.setValue(draft.gardenSizeSqm);
          if (draft.parkingSpaces != null) this.form.controls.parkingSpaces.setValue(draft.parkingSpaces);
          if (draft.parkingIsCovered != null) this.form.controls.parkingIsCovered.setValue(draft.parkingIsCovered);
          if (draft.floors != null) this.form.controls.floors.setValue(draft.floors);
          if (draft.yearBuilt != null) this.form.controls.yearBuilt.setValue(draft.yearBuilt);
          if (draft.constructionCondition) this.form.controls.constructionCondition.setValue(draft.constructionCondition);
          if (draft.hasKitchen != null) this.form.controls.hasKitchen.setValue(draft.hasKitchen);
          if (draft.hasLivingRoom != null) this.form.controls.hasLivingRoom.setValue(draft.hasLivingRoom);
          if (draft.hasDiningRoom != null) this.form.controls.hasDiningRoom.setValue(draft.hasDiningRoom);
          if (draft.hasPool != null) this.form.controls.hasPool.setValue(draft.hasPool);
          if (draft.hasRoofGarden != null) this.form.controls.hasRoofGarden.setValue(draft.hasRoofGarden);
          if (draft.hasTerrace != null) this.form.controls.hasTerrace.setValue(draft.hasTerrace);
          if (draft.hasBalcony != null) this.form.controls.hasBalcony.setValue(draft.hasBalcony);
          if (draft.hasLaundryArea != null) this.form.controls.hasLaundryArea.setValue(draft.hasLaundryArea);
          if (draft.hasCistern != null) this.form.controls.hasCistern.setValue(draft.hasCistern);
          if (draft.cisternCapacityLiters != null) this.form.controls.cisternCapacityLiters.setValue(draft.cisternCapacityLiters);
          if (draft.hasWell != null) this.form.controls.hasWell.setValue(draft.hasWell);
          if (draft.hasNaturalGas != null) this.form.controls.hasNaturalGas.setValue(draft.hasNaturalGas);
          if (draft.hasLpGas != null) this.form.controls.hasLpGas.setValue(draft.hasLpGas);
          if (draft.hasSecurity != null) this.form.controls.hasSecurity.setValue(draft.hasSecurity);
          if (draft.hasElevator != null) this.form.controls.hasElevator.setValue(draft.hasElevator);
          if (draft.hasGym != null) this.form.controls.hasGym.setValue(draft.hasGym);
          if (draft.hasBbqArea != null) this.form.controls.hasBbqArea.setValue(draft.hasBbqArea);
          if (draft.hasServiceRoom != null) this.form.controls.hasServiceRoom.setValue(draft.hasServiceRoom);
          if (draft.hasStorageRoom != null) this.form.controls.hasStorageRoom.setValue(draft.hasStorageRoom);
          if (draft.hasPropertyTaxDebt != null) this.form.controls.hasPropertyTaxDebt.setValue(draft.hasPropertyTaxDebt);
          if (draft.hasPotableWater != null) this.form.controls.hasPotableWater.setValue(draft.hasPotableWater);
          if (draft.hasDrainage != null) this.form.controls.hasDrainage.setValue(draft.hasDrainage);
          if (draft.hasElectricity != null) this.form.controls.hasElectricity.setValue(draft.hasElectricity);
          if (draft.hasPavedStreet != null) this.form.controls.hasPavedStreet.setValue(draft.hasPavedStreet);
          if (draft.isCornerLot != null) this.form.controls.isCornerLot.setValue(draft.isCornerLot);
          if (draft.lat != null && draft.lng != null) {
            this.draftLat = draft.lat;
            this.draftLng = draft.lng;
            // Re-derives street/colonia/city/state/zipCode from this more precise location —
            // reverseGeocodeAddress only ever fills a field that's still empty (see its own doc
            // comment), so this can't overwrite anything the AI extraction (or the owner) already
            // set above, only backfill what's still missing.
            this.reverseGeocodeAddress(draft.lat, draft.lng);
          } else if (draft.mapsLinkResolutionFailed) {
            this.notification.error('listingForm.pasteAdInvalidMapsLink');
          }
          this.syncPricePerSqmFromPrice();
          this.notification.success('listingForm.pasteAdSuccess');
        },
        error: () => this.notification.error('listingForm.pasteAdError')
      });
  }

  readonly generatingDescription = signal(false);

  // The mirror image of autofillFromDraft above: structured fields -> a drafted description,
  // instead of free text -> structured fields. Always overwrites the description control (same
  // "owner reviews/edits before saving, nothing auto-publishes" reasoning as autofillFromDraft) —
  // there's no partial-merge concern here since there's only one field to fill, unlike the ~40
  // fields autofillFromDraft can touch.
  generateDescription(): void {
    if (this.generatingDescription()) return;

    // Unlike autofillFromDraft (only reachable on a blank new-listing form, so there's never
    // real data to lose — see its own comment), this button is also reachable in isEditMode, on
    // an already-published listing whose description a human may have carefully written. Silently
    // overwriting that with no confirmation is exactly the kind of real-data loss this app's
    // conventions guard against elsewhere (listingDetail.deleteConfirm et al. use the same
    // window.confirm pattern) — only prompt when there's actually something to lose, so a blank
    // description (the common new-listing case) still generates in one click.
    const existing = this.form.controls.description.value.trim();
    if (existing && !confirm(this.translation.t('listingForm.generateDescriptionOverwriteConfirm'))) return;

    const raw = this.form.getRawValue();
    this.generatingDescription.set(true);

    this.listingService
      .generateDescription({
        listingType: raw.type,
        propertyType: this.translation.t('listingForm.' + raw.propertyType),
        price: raw.priceOnRequest ? null : raw.price,
        currency: raw.currency,
        colonia: raw.colonia || null,
        city: raw.city || null,
        state: raw.state || null,
        bedrooms: raw.bedrooms,
        bathrooms: raw.bathrooms,
        areaSqm: raw.areaSqm,
        lotSizeSqm: raw.lotSizeSqm,
        parkingSpaces: raw.parkingSpaces,
        floors: raw.floors,
        yearBuilt: raw.yearBuilt,
        constructionCondition: raw.constructionCondition
          ? this.translation.t('listingForm.condition' + raw.constructionCondition.charAt(0).toUpperCase() + raw.constructionCondition.slice(1))
          : null,
        hasPool: raw.hasPool,
        hasRoofGarden: raw.hasRoofGarden,
        hasTerrace: raw.hasTerrace,
        hasBalcony: raw.hasBalcony,
        hasSecurity: raw.hasSecurity,
        hasElevator: raw.hasElevator,
        hasGym: raw.hasGym,
        hasBbqArea: raw.hasBbqArea,
        hasNaturalGas: raw.hasNaturalGas,
        hasWell: raw.hasWell,
        isCornerLot: raw.isCornerLot,
        hasPotableWater: raw.hasPotableWater,
        hasDrainage: raw.hasDrainage,
        hasElectricity: raw.hasElectricity,
        hasPavedStreet: raw.hasPavedStreet
      })
      .pipe(finalize(() => this.generatingDescription.set(false)))
      .subscribe({
        next: (description) => {
          if (!description) {
            this.notification.error('listingForm.generateDescriptionEmpty');
            return;
          }
          this.form.controls.description.setValue(description);
          this.notification.success('listingForm.generateDescriptionSuccess');
        },
        error: () => this.notification.error('listingForm.generateDescriptionError')
      });
  }

  // Only overwrites a field that's still at its untouched default — if reverse geocoding takes
  // long enough that the owner already started typing (or the browser only got a partial
  // address back), their own input always wins over whatever this fills in.
  private reverseGeocodeAddress(lat: number, lng: number): void {
    loadGoogleMaps()
      .then(() => {
        new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
          if (status !== 'OK' || !results?.length) return;

          const components = results[0].address_components;
          const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name;

          const streetNumber = find('street_number');
          const route = find('route');
          const street = [route, streetNumber].filter(Boolean).join(' ');
          const colonia = find('sublocality_level_1') ?? find('sublocality') ?? find('neighborhood');
          const city = find('locality') ?? find('administrative_area_level_2');
          const state = find('administrative_area_level_1');
          const zipCode = find('postal_code');

          const patch: Record<string, string> = {};
          if (street && !this.form.controls.street.value) patch['street'] = street;
          if (colonia && !this.form.controls.colonia.value) patch['colonia'] = colonia;
          if (city && !this.form.controls.city.value) patch['city'] = city;
          if (state && this.form.controls.state.value === 'Puebla') patch['state'] = state;
          if (zipCode && !this.form.controls.zipCode.value) patch['zipCode'] = zipCode;
          if (Object.keys(patch).length) this.form.patchValue(patch);
        });
      })
      .catch(() => {
        // No Maps script, no network — the form is still fully usable by hand, so this fails
        // silently rather than blocking or warning about a purely optional convenience.
      });
  }

  // Accent/case-insensitive match: state is free text (see the State input's datalist), so
  // "puebla" or "Queretaro" typed by hand should filter the same as the catalog's own spelling.
  private filterCitiesByState(municipalities: MunicipalityListItem[], state: string): MunicipalityListItem[] {
    const normalized = normalizeText(state);
    return municipalities.filter((m) => normalizeText(m.stateName) === normalized);
  }

  // Combined display order: existing photos first, then newly picked ones — matches the
  // order the backend saves them in (BuildImageUrlsAsync).
  readonly displayImages = () => [
    ...this.existingImageUrls(),
    ...this.newPhotos().map((p) => p.previewUrl)
  ];

  isLandOrCommercial(): boolean {
    return isLandOrCommercialPropertyType(this.form.value.propertyType);
  }

  // The "Uso de suelo" catalog dropdown only makes sense for the generic "Terreno" ('land')
  // property type — not residentialLand/commercialLand/industrialLand, which are their own
  // specific categories, and not the built/commercial property types isLandOrCommercial() covers.
  isLand(): boolean {
    return this.form.value.propertyType === 'land';
  }

  // The "número de locales comerciales" input only makes sense for a plaza comercial, not every
  // LAND_OR_COMMERCIAL_PROPERTY_TYPES member (an office or warehouse isn't subdivided into
  // independently rentable units the same way).
  isShoppingPlaza(): boolean {
    return this.form.value.propertyType === 'shoppingPlaza';
  }

  // Raw land: no structure exists, so parking/floors/year-built/heating-cooling don't apply
  // either (on top of the residential-dwelling fields isLandOrCommercial() already covers).
  isPureLand(): boolean {
    return isPureLandPropertyType(this.form.value.propertyType);
  }

  // A single apartment unit wouldn't have its own well — every other property type can.
  isWellAvailable(): boolean {
    return this.form.value.propertyType !== 'apartment';
  }

  // Rooms (cocina/sala/comedor) + amenities section — only for a self-contained dwelling unit,
  // not raw land/commercial-industrial structures or a single rented room.
  isHouseOrApartment(): boolean {
    return isHouseOrApartmentPropertyType(this.form.value.propertyType);
  }

  get priceInWords(): string {
    return amountToWords(
      this.form.value.price ?? 0,
      this.translation.lang(),
      this.form.value.currency ?? 'MXN'
    );
  }

  private parseCoordinate(value: string | null): number | null {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const remainingSlots = MAX_PHOTOS_PER_LISTING - this.existingImageUrls().length - this.newPhotos().length;
    if (remainingSlots <= 0) {
      this.notification.error('listingForm.tooManyPhotosError');
      input.value = '';
      return;
    }

    // Validate type/size up front (matches PhotoUploadService's server-side checks) so a
    // rejected file never reaches the FileReader/preview step, and only surface one toast per
    // problem kind even if several files share the same issue.
    const accepted: File[] = [];
    let hasTypeError = false;
    let hasSizeError = false;
    for (const file of Array.from(files)) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        hasTypeError = true;
      } else if (file.size > MAX_PHOTO_BYTES) {
        hasSizeError = true;
      } else {
        accepted.push(file);
      }
    }
    if (hasTypeError) this.notification.error('listingForm.photoTypeError');
    if (hasSizeError) this.notification.error('listingForm.photoSizeError');

    const overflow = accepted.length > remainingSlots;
    const toRead = accepted.slice(0, remainingSlots);
    if (overflow) this.notification.error('listingForm.tooManyPhotosError');

    // Read every file in parallel but wait for all of them before appending, so selection
    // order is preserved regardless of which FileReader happens to finish first (readers
    // resolve independently and are not guaranteed to complete in the order they started).
    const reads = toRead.map(
      (file) =>
        new Promise<{ file: File; previewUrl: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ file, previewUrl: reader.result as string });
          reader.readAsDataURL(file);
        })
    );

    Promise.all(reads).then((newlyRead) => {
      this.newPhotos.update((photos) => [...photos, ...newlyRead]);
    });

    input.value = '';
  }

  removeImage(index: number): void {
    const existingCount = this.existingImageUrls().length;
    if (index < existingCount) {
      this.existingImageUrls.update((urls) => urls.filter((_, i) => i !== index));
    } else {
      const photoIndex = index - existingCount;
      this.newPhotos.update((photos) => photos.filter((_, i) => i !== photoIndex));
    }
  }

  // Index of the thumbnail currently being dragged (set on dragstart, read on drop), so
  // reorderImages below knows which displayImages() position to move — null the rest of the
  // time, including right after a drop or a drag that ends outside any valid drop target.
  readonly draggedPhotoIndex = signal<number | null>(null);

  onPhotoDragStart(event: DragEvent, index: number): void {
    this.draggedPhotoIndex.set(index);
    // Firefox won't start a native drag at all unless dataTransfer carries some data; the value
    // itself is never read back (the drop handler reads draggedPhotoIndex instead).
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  // Without this, the browser's default is to refuse the drop entirely (shown as a "not
  // allowed" cursor) — dragover must call preventDefault() on every fired event for drop to work.
  onPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onPhotoDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const fromIndex = this.draggedPhotoIndex();
    this.draggedPhotoIndex.set(null);
    if (fromIndex === null || fromIndex === targetIndex) return;
    this.reorderImages(fromIndex, targetIndex);
  }

  onPhotoDragEnd(): void {
    this.draggedPhotoIndex.set(null);
  }

  // Whether displayImages()[index] can actually become the overall-primary (index 0) photo —
  // see reorderImages' doc comment for why a newly picked photo can't, once any already-hosted
  // photo exists. Drives whether the template even shows "Hacer principal" for that thumbnail.
  canBePrimary(index: number): boolean {
    const existingCount = this.existingImageUrls().length;
    return existingCount === 0 || index < existingCount;
  }

  // Moves whatever's at displayImages()[index] to the front — the explicit "Hacer principal"
  // affordance, for anyone who'd rather click than drag (and the only way to do it at all on a
  // touchscreen, where the native HTML5 drag-and-drop this form otherwise relies on doesn't fire).
  makePrimary(index: number): void {
    if (!this.canBePrimary(index)) return;
    this.reorderImages(index, 0);
  }

  // existingImageUrls and newPhotos are two independently ordered signals, concatenated by
  // displayImages() in that fixed order (see its own comment) because the backend
  // (BuildImageUrlsAsync) always saves already-hosted photos before newly uploaded ones — a
  // newly picked file can never land before an existing photo no matter what order the frontend
  // sends them in. So reordering only moves an item within its own group (existing photos among
  // themselves, or new photos among themselves); a drag that crosses the boundary is a no-op
  // instead of appearing to work and then snapping back once the two signals recombine.
  private reorderImages(fromIndex: number, toIndex: number): void {
    const existingCount = this.existingImageUrls().length;
    const fromIsExisting = fromIndex < existingCount;
    const toIsExisting = toIndex < existingCount;
    if (fromIsExisting !== toIsExisting) return;

    if (fromIsExisting) {
      this.existingImageUrls.update((urls) => moveItem(urls, fromIndex, toIndex));
    } else {
      this.newPhotos.update((photos) => moveItem(photos, fromIndex - existingCount, toIndex - existingCount));
    }
  }

  // The owner-contact section's own save action — kept separate from submit() below because it
  // hits a different endpoint (ListingsController.UpdateOwnerContact) with no photo/field
  // validation of its own, and is the ONLY action available to an admin editing a listing they
  // don't own (see showMainForm above).
  submitOwnerContact(): void {
    if (!this.editingId || this.isSavingOwnerContact()) return;

    const raw = this.ownerContactForm.getRawValue();
    const ownerContactEmail = raw.ownerContactEmail.trim() || undefined;

    // Mirrors ListingsController.UpdateOwnerContact's own check — catching it here avoids a
    // round-trip just to get back the same validation error, and gives a more specific toast
    // than the generic ownerContactSaveError below.
    if (raw.hideAgentContact && !ownerContactEmail) {
      this.notification.error('listingForm.ownerContactEmailRequired');
      return;
    }

    this.isSavingOwnerContact.set(true);
    this.listingService
      .updateOwnerContact(this.editingId, {
        hideAgentContact: raw.hideAgentContact,
        ownerContactName: raw.ownerContactName.trim() || undefined,
        ownerContactPhone: raw.ownerContactPhone.trim() || undefined,
        ownerContactEmail
      })
      .pipe(finalize(() => this.isSavingOwnerContact.set(false)))
      .subscribe({
        next: () => {
          this.notification.success('listingForm.ownerContactSaveSuccess');
          if (!this.showMainForm()) this.router.navigateByUrl(this.translation.path('listings', this.editingId!));
        },
        error: () => this.notification.error('listingForm.ownerContactSaveError')
      });
  }

  submit(): void {
    if (!this.showMainForm()) return; // admin-but-not-owner: nothing here to submit
    if (this.isSubmitting()) return; // already in flight — ignore a double click/Enter

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notification.error('listingForm.formHasErrors');
      this.scrollToFirstInvalid();
      return;
    }

    if (!this.existingImageUrls().length && !this.newPhotos().length) {
      this.notification.error('listingForm.atLeastOnePhoto');
      return;
    }

    const raw = this.form.getRawValue();

    // price's own validator only enforces >= 0 (not > 0) because 0 is the legitimate value while
    // "price on request" is checked — so a genuinely missing price has to be caught here instead,
    // once we know which case this is.
    if (!raw.priceOnRequest && raw.price <= 0) {
      this.notification.error('listingForm.priceRequired');
      return;
    }

    // Fields hidden by isLandOrCommercial()/isPureLand() keep whatever value was last typed
    // into them (Angular doesn't clear a control just because its template @if stops
    // rendering it) — without this, switching property type right before submitting would
    // silently ship stale residential/structure data for a type that no longer shows those
    // fields at all.
    const landOrCommercial = this.isLandOrCommercial();
    const pureLand = this.isPureLand();
    const isLand = this.isLand();
    const wellAvailable = this.isWellAvailable();
    const houseOrApartment = this.isHouseOrApartment();
    const shoppingPlaza = this.isShoppingPlaza();
    // A shopping plaza with hasApartmentUnit checked still reports real bedrooms/bathrooms (for
    // the included dwelling unit) instead of being zeroed out like every other land/commercial
    // listing — see HasApartmentUnit's own comment on the Listing entity.
    const includesApartment = shoppingPlaza && raw.hasApartmentUnit === true;
    const value: ListingInput = {
      ...raw,
      bedrooms: landOrCommercial && !includesApartment ? 0 : raw.bedrooms,
      bathrooms: landOrCommercial && !includesApartment ? 0 : raw.bathrooms,
      hasApartmentUnit: shoppingPlaza ? (raw.hasApartmentUnit ?? undefined) : undefined,
      landUseCategoryId: isLand ? (raw.landUseCategoryId ?? undefined) : undefined,
      gardenSizeSqm: landOrCommercial ? undefined : (raw.gardenSizeSqm ?? undefined),
      hoaFee: landOrCommercial ? undefined : (raw.hoaFee ?? undefined),
      yearBuilt: pureLand ? undefined : (raw.yearBuilt ?? undefined),
      constructionCondition: pureLand ? undefined : (raw.constructionCondition ?? undefined),
      parkingSpaces: pureLand ? undefined : (raw.parkingSpaces ?? undefined),
      parkingIsCovered: pureLand ? undefined : (raw.parkingIsCovered ?? undefined),
      floors: pureLand ? undefined : (raw.floors ?? undefined),
      hasHeatingCooling: pureLand ? false : raw.hasHeatingCooling,
      hasRoofGarden: pureLand ? false : raw.hasRoofGarden,
      facadeOrientation: raw.facadeOrientation ?? undefined,
      hasNaturalGas: raw.hasNaturalGas ?? undefined,
      hasLpGas: raw.hasLpGas ?? undefined,
      hasCistern: raw.hasCistern ?? undefined,
      // Only submitted while hasCistern is actually checked — the control itself isn't cleared
      // when the field hides (see its own comment), so this stops a stale value typed before
      // unchecking the box from silently surviving into the saved listing.
      cisternCapacityLiters: raw.hasCistern ? (raw.cisternCapacityLiters ?? undefined) : undefined,
      hasWell: wellAvailable ? (raw.hasWell ?? undefined) : undefined,
      hasKitchen: houseOrApartment ? (raw.hasKitchen ?? undefined) : undefined,
      hasLivingRoom: houseOrApartment ? (raw.hasLivingRoom ?? undefined) : undefined,
      hasDiningRoom: houseOrApartment ? (raw.hasDiningRoom ?? undefined) : undefined,
      hasPool: houseOrApartment ? (raw.hasPool ?? undefined) : undefined,
      hasTerrace: houseOrApartment ? (raw.hasTerrace ?? undefined) : undefined,
      hasBalcony: houseOrApartment ? (raw.hasBalcony ?? undefined) : undefined,
      hasServiceRoom: houseOrApartment ? (raw.hasServiceRoom ?? undefined) : undefined,
      hasLaundryArea: houseOrApartment ? (raw.hasLaundryArea ?? undefined) : undefined,
      hasStorageRoom: houseOrApartment ? (raw.hasStorageRoom ?? undefined) : undefined,
      hasGym: houseOrApartment ? (raw.hasGym ?? undefined) : undefined,
      hasSecurity: houseOrApartment ? (raw.hasSecurity ?? undefined) : undefined,
      hasElevator: houseOrApartment ? (raw.hasElevator ?? undefined) : undefined,
      hasBbqArea: houseOrApartment ? (raw.hasBbqArea ?? undefined) : undefined,
      lotSizeSqm: raw.lotSizeSqm ?? undefined,
      // Nullish-guarded even though the control is typed as a plain (non-nullable) string:
      // patchValue() (edit mode, see constructor) sets it straight from a Listing whose
      // videoTourUrl is genuinely optional, which can leave the control's runtime value
      // undefined despite what the type says.
      videoTourUrl: (raw.videoTourUrl ?? '').trim() || undefined,
      landUseZoning: (raw.landUseZoning ?? '').trim() || undefined,
      landTenure: raw.landTenure ?? undefined,
      hasEjidalCertificate: raw.hasEjidalCertificate ?? undefined,
      cosCoefficient: raw.cosCoefficient ?? undefined,
      cusCoefficient: raw.cusCoefficient ?? undefined,
      maxHeightMeters: raw.maxHeightMeters ?? undefined,
      isFreeOfLiens: raw.isFreeOfLiens ?? undefined,
      hasPropertyTaxDebt: raw.hasPropertyTaxDebt ?? undefined,
      hasWaterDebt: raw.hasWaterDebt ?? undefined,
      frontageWidthMeters: raw.frontageWidthMeters ?? undefined,
      frontageDepthMeters: raw.frontageDepthMeters ?? undefined,
      commercialUnitCount: raw.commercialUnitCount ?? undefined,
      // Defaults to true (see the control's own comment) — only actually submitted when the
      // checkbox is visible somewhere (land/commercial section or the house/apartment Rooms
      // section). Without this gate, a Ranch/Room listing (neither isLandOrCommercial() nor
      // isHouseOrApartment()) would silently publish "sí" for a checkbox it never showed.
      hasPotableWater: (landOrCommercial || houseOrApartment) ? (raw.hasPotableWater ?? undefined) : undefined,
      hasDrainage: (landOrCommercial || houseOrApartment) ? (raw.hasDrainage ?? undefined) : undefined,
      hasElectricity: (landOrCommercial || houseOrApartment) ? (raw.hasElectricity ?? undefined) : undefined,
      hasThreePhaseElectricity: raw.hasThreePhaseElectricity ?? undefined,
      hasTelecomService: raw.hasTelecomService ?? undefined,
      hasVehicleAccess: raw.hasVehicleAccess ?? undefined,
      hasPavedStreet: raw.hasPavedStreet ?? undefined,
      hasNearbyUTurn: raw.hasNearbyUTurn ?? undefined,
      isCornerLot: raw.isCornerLot ?? undefined,
      streetFrontageCount: raw.streetFrontageCount ?? undefined,
      primaryVialidadType: raw.primaryVialidadType ?? undefined,
      lotShape: raw.lotShape ?? undefined,
      topography: raw.topography ?? undefined,
      isFloodRiskZone: raw.isFloodRiskZone ?? undefined,
      cadastralValue: raw.cadastralValue ?? undefined,
      brokerageId: raw.brokerageId ?? undefined,
      existingImageUrls: this.existingImageUrls(),
      photos: this.newPhotos().map((p) => p.file),
      lat: this.draftLat ?? this.lat ?? this.existingLat ?? undefined,
      lng: this.draftLng ?? this.lng ?? this.existingLng ?? undefined
    };

    const request$ = this.editingId
      ? this.listingService.update(this.editingId, value)
      : this.listingService.create(value);

    this.isSubmitting.set(true);
    request$.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (listing) => {
        this.notification.success(this.isEditMode ? 'listingForm.updateSuccess' : 'listingForm.createSuccess');
        this.router.navigateByUrl(this.translation.path('listings', listing.id));
      },
      error: (err: HttpErrorResponse) => {
        // A 401 is handled globally by the auth interceptor (logout + redirect to /login), so
        // it never reaches here. Photo-specific and 403 cases each have a message that tells the
        // owner exactly what to do — nothing more to investigate, so only the remaining "we
        // don't actually know why" fallback gets reported to the in-app error log (see
        // ErrorReportingService). Without this, a case like this one was completely invisible
        // after the fact: the toast is shown and gone, with no trace for an admin to look up later.
        const key =
          err.status === 403
            ? 'listingForm.forbiddenError'
            : err.status === 502
              ? 'listingForm.photoUploadError'
              : err.status === 400 && err.error?.message === 'Photos must be JPEG, PNG, or WEBP images.'
                ? 'listingForm.photoTypeError'
                : err.status === 400 && err.error?.message === 'Each photo must be 5 MB or smaller.'
                  ? 'listingForm.photoSizeError'
                  : err.status === 400 && typeof err.error?.message === 'string' && err.error.message.includes('per month')
                    ? 'listingForm.quotaExceededError'
                    : err.status === 400 && typeof err.error?.message === 'string' && err.error.message.includes('at most')
                      ? 'listingForm.tooManyPhotosError'
                      : 'listingForm.submitError';
        this.notification.error(key);
        if (key === 'listingForm.submitError') {
          const action = this.isEditMode ? 'update' : 'create';
          this.errorReporting.report(
            `HTTP ${err.status}${err.statusText ? ' ' + err.statusText : ''} for ${err.url ?? 'unknown URL'} (listing ${action})`
          );
        }
      }
    });
  }

  // Jumps to (and focuses) the first control Angular has marked invalid, right after
  // markAllAsTouched() makes its red border/inline message appear — without this, a long form
  // like this one can leave an invalid field scrolled off-screen with no clue where it is.
  private scrollToFirstInvalid(): void {
    // Not just '.ng-invalid' — Angular puts that class on the <form> element itself too (the
    // FormGroup as a whole is invalid), and as the outermost element it would always "win" a
    // plain querySelector, scrolling nowhere. Scoped to the actual controls.
    const invalidEl = this.elementRef.nativeElement.querySelector<HTMLElement>(
      'input.ng-invalid, select.ng-invalid, textarea.ng-invalid'
    );
    invalidEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    invalidEl?.focus();
  }
}
