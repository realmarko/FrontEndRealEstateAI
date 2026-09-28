import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ListingService } from '../../../core/services/listing.service';
import { GeomarketingService, MunicipalityListItem, StateListItem } from '../../../core/services/geomarketing.service';
import { LandUseCategory, LandUseCategoryService } from '../../../core/services/land-use-category.service';
import {
  Currency,
  LandTenureType,
  ListingInput,
  LotShapeType,
  PROPERTY_TYPE_OPTIONS,
  PropertyType,
  TopographyType,
  VialidadType,
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
import { MortgageCalculatorComponent } from '../../../shared/components/mortgage-calculator/mortgage-calculator.component';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { ListingQuotaComponent } from '../../../shared/components/listing-quota/listing-quota.component';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';

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
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, CurrencyInputDirective, MortgageCalculatorComponent, FormErrorComponent, ListingQuotaComponent],
  templateUrl: './listing-form.component.html',
  styleUrl: './listing-form.component.css'
})
export class ListingFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly geomarketingService = inject(GeomarketingService);
  private readonly landUseCategoryService = inject(LandUseCategoryService);
  private readonly translation = inject(TranslationService);
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
    zipCode: [''],
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
    floors: this.fb.control<number | null>(null, Validators.min(0)),
    lotSizeSqm: this.fb.control<number | null>(null, Validators.min(0)),
    gardenSizeSqm: this.fb.control<number | null>(null, Validators.min(0)),
    hasHeatingCooling: [false],
    hoaFee: this.fb.control<number | null>(null, Validators.min(0)),
    videoTourUrl: ['', optionalUrlValidator],
    landUseZoning: this.fb.control<string | null>(null),
    landUseCategoryId: this.fb.control<number | null>(null),
    landTenure: this.fb.control<LandTenureType | null>(null),
    cosCoefficient: this.fb.control<number | null>(null, Validators.min(0)),
    cusCoefficient: this.fb.control<number | null>(null, Validators.min(0)),
    maxHeightMeters: this.fb.control<number | null>(null, Validators.min(0)),
    isFreeOfLiens: this.fb.control<boolean | null>(null),
    hasPropertyTaxDebt: this.fb.control<boolean | null>(null),
    hasWaterDebt: this.fb.control<boolean | null>(null),
    frontageWidthMeters: this.fb.control<number | null>(null, Validators.min(0)),
    frontageDepthMeters: this.fb.control<number | null>(null, Validators.min(0)),
    hasPotableWater: this.fb.control<boolean | null>(null),
    hasDrainage: this.fb.control<boolean | null>(null),
    hasElectricity: this.fb.control<boolean | null>(null),
    hasThreePhaseElectricity: this.fb.control<boolean | null>(null),
    hasTelecomService: this.fb.control<boolean | null>(null),
    hasVehicleAccess: this.fb.control<boolean | null>(null),
    hasNearbyUTurn: this.fb.control<boolean | null>(null),
    isCornerLot: this.fb.control<boolean | null>(null),
    streetFrontageCount: this.fb.control<number | null>(null, Validators.min(0)),
    primaryVialidadType: this.fb.control<VialidadType | null>(null),
    lotShape: this.fb.control<LotShapeType | null>(null),
    topography: this.fb.control<TopographyType | null>(null),
    isFloodRiskZone: this.fb.control<boolean | null>(null),
    cadastralValue: this.fb.control<number | null>(null, Validators.min(0))
  });

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
  readonly states = signal<StateListItem[]>([]);
  readonly municipalities = signal<MunicipalityListItem[]>([]);
  readonly citiesForState = signal<MunicipalityListItem[]>([]);
  readonly landUseCategories = signal<LandUseCategory[]>([]);

  private existingLat: number | null = null;
  private existingLng: number | null = null;

  constructor() {
    this.landUseCategoryService.listAll().subscribe((list) => this.landUseCategories.set(list));
    this.geomarketingService.listStates().subscribe((list) => this.states.set(list));
    this.geomarketingService.listMunicipalities().subscribe((list) => {
      this.municipalities.set(list);
      this.citiesForState.set(this.filterCitiesByState(list, this.form.controls.state.value));
    });
    this.form.controls.state.valueChanges.subscribe((state) => {
      this.citiesForState.set(this.filterCitiesByState(this.municipalities(), state));
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
      });
    } else if (this.lat !== null && this.lng !== null) {
      // Arriving here from the map's "Continue with this location" — best-effort autofill so
      // the owner doesn't have to retype an address the map already knows the coordinates of.
      // Never blocks or fails the form: every address field stays freely editable regardless of
      // whether (or how much of) this succeeds.
      this.reverseGeocodeAddress(this.lat, this.lng);
    }
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

  // Raw land: no structure exists, so parking/floors/year-built/heating-cooling don't apply
  // either (on top of the residential-dwelling fields isLandOrCommercial() already covers).
  isPureLand(): boolean {
    return isPureLandPropertyType(this.form.value.propertyType);
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

    // Read every file in parallel but wait for all of them before appending, so selection
    // order is preserved regardless of which FileReader happens to finish first (readers
    // resolve independently and are not guaranteed to complete in the order they started).
    const reads = Array.from(files).map(
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

  submit(): void {
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
    // Fields hidden by isLandOrCommercial()/isPureLand() keep whatever value was last typed
    // into them (Angular doesn't clear a control just because its template @if stops
    // rendering it) — without this, switching property type right before submitting would
    // silently ship stale residential/structure data for a type that no longer shows those
    // fields at all.
    const landOrCommercial = this.isLandOrCommercial();
    const pureLand = this.isPureLand();
    const isLand = this.isLand();
    const value: ListingInput = {
      ...raw,
      bedrooms: landOrCommercial ? 0 : raw.bedrooms,
      bathrooms: landOrCommercial ? 0 : raw.bathrooms,
      landUseCategoryId: isLand ? (raw.landUseCategoryId ?? undefined) : undefined,
      gardenSizeSqm: landOrCommercial ? undefined : (raw.gardenSizeSqm ?? undefined),
      hoaFee: landOrCommercial ? undefined : (raw.hoaFee ?? undefined),
      yearBuilt: pureLand ? undefined : (raw.yearBuilt ?? undefined),
      parkingSpaces: pureLand ? undefined : (raw.parkingSpaces ?? undefined),
      floors: pureLand ? undefined : (raw.floors ?? undefined),
      hasHeatingCooling: pureLand ? false : raw.hasHeatingCooling,
      lotSizeSqm: raw.lotSizeSqm ?? undefined,
      // Nullish-guarded even though the control is typed as a plain (non-nullable) string:
      // patchValue() (edit mode, see constructor) sets it straight from a Listing whose
      // videoTourUrl is genuinely optional, which can leave the control's runtime value
      // undefined despite what the type says.
      videoTourUrl: (raw.videoTourUrl ?? '').trim() || undefined,
      landUseZoning: (raw.landUseZoning ?? '').trim() || undefined,
      landTenure: raw.landTenure ?? undefined,
      cosCoefficient: raw.cosCoefficient ?? undefined,
      cusCoefficient: raw.cusCoefficient ?? undefined,
      maxHeightMeters: raw.maxHeightMeters ?? undefined,
      isFreeOfLiens: raw.isFreeOfLiens ?? undefined,
      hasPropertyTaxDebt: raw.hasPropertyTaxDebt ?? undefined,
      hasWaterDebt: raw.hasWaterDebt ?? undefined,
      frontageWidthMeters: raw.frontageWidthMeters ?? undefined,
      frontageDepthMeters: raw.frontageDepthMeters ?? undefined,
      hasPotableWater: raw.hasPotableWater ?? undefined,
      hasDrainage: raw.hasDrainage ?? undefined,
      hasElectricity: raw.hasElectricity ?? undefined,
      hasThreePhaseElectricity: raw.hasThreePhaseElectricity ?? undefined,
      hasTelecomService: raw.hasTelecomService ?? undefined,
      hasVehicleAccess: raw.hasVehicleAccess ?? undefined,
      hasNearbyUTurn: raw.hasNearbyUTurn ?? undefined,
      isCornerLot: raw.isCornerLot ?? undefined,
      streetFrontageCount: raw.streetFrontageCount ?? undefined,
      primaryVialidadType: raw.primaryVialidadType ?? undefined,
      lotShape: raw.lotShape ?? undefined,
      topography: raw.topography ?? undefined,
      isFloodRiskZone: raw.isFloodRiskZone ?? undefined,
      cadastralValue: raw.cadastralValue ?? undefined,
      existingImageUrls: this.existingImageUrls(),
      photos: this.newPhotos().map((p) => p.file),
      lat: this.lat ?? this.existingLat ?? undefined,
      lng: this.lng ?? this.existingLng ?? undefined
    };

    const request$ = this.editingId
      ? this.listingService.update(this.editingId, value)
      : this.listingService.create(value);

    this.isSubmitting.set(true);
    request$.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: (listing) => {
        this.notification.success(this.isEditMode ? 'listingForm.updateSuccess' : 'listingForm.createSuccess');
        this.router.navigate(['/listings', listing.id]);
      },
      error: (err: HttpErrorResponse) => {
        // Photo-specific and 401/403 cases each have a message that tells the owner exactly
        // what to do — nothing more to investigate, so only the remaining "we don't actually
        // know why" fallback gets reported to the in-app error log (see ErrorReportingService).
        // Without this, a case like this one was completely invisible after the fact: the toast
        // is shown and gone, with no trace for an admin to look up later.
        const key =
          err.status === 401
            ? 'listingForm.sessionExpiredError'
            : err.status === 403
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
