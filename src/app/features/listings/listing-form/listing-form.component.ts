import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormsModule, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ListingService } from '../../../core/services/listing.service';
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
import { amountToWords } from '../../../shared/utils/amount-to-words';
import { CurrencyInputDirective } from '../../../shared/directives/currency-input.directive';
import { MortgageCalculatorComponent } from '../../../shared/components/mortgage-calculator/mortgage-calculator.component';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TranslatePipe, CurrencyInputDirective, MortgageCalculatorComponent],
  templateUrl: './listing-form.component.html',
  styleUrl: './listing-form.component.css'
})
export class ListingFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly translation = inject(TranslationService);
  private readonly notification = inject(NotificationService);

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
    address: ['', Validators.required],
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
  newImageUrl = '';

  private existingLat: number | null = null;
  private existingLng: number | null = null;

  constructor() {
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
    }
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

  addImageUrl(): void {
    const url = this.newImageUrl.trim();
    if (!url) return;
    this.existingImageUrls.update((urls) => [...urls, url]);
    this.newImageUrl = '';
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
    const value: ListingInput = {
      ...raw,
      bedrooms: landOrCommercial ? 0 : raw.bedrooms,
      bathrooms: landOrCommercial ? 0 : raw.bathrooms,
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

    request$.subscribe({
      next: (listing) => {
        this.notification.success(this.isEditMode ? 'listingForm.updateSuccess' : 'listingForm.createSuccess');
        this.router.navigate(['/listings', listing.id]);
      },
      error: (err) => {
        const key =
          err.status === 502
            ? 'listingForm.photoUploadError'
            : err.status === 400 && err.error?.message === 'Photos must be JPEG, PNG, or WEBP images.'
              ? 'listingForm.photoTypeError'
              : err.status === 400 && err.error?.message === 'Each photo must be 5 MB or smaller.'
                ? 'listingForm.photoSizeError'
                : 'listingForm.submitError';
        this.notification.error(key);
      }
    });
  }
}
