import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ListingService } from '../../../core/services/listing.service';
import { Currency, ListingInput, PropertyType } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { amountToWords } from '../../../shared/utils/amount-to-words';
import { CurrencyInputDirective } from '../../../shared/directives/currency-input.directive';

@Component({
  selector: 'app-listing-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TranslatePipe, CurrencyInputDirective],
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

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    currency: ['MXN' as Currency, Validators.required],
    type: ['rent' as 'rent' | 'sale', Validators.required],
    propertyType: ['house' as PropertyType, Validators.required],
    address: ['', Validators.required],
    bedrooms: [1, [Validators.required, Validators.min(0)]],
    bathrooms: [1, [Validators.required, Validators.min(0)]],
    areaSqm: [0, [Validators.required, Validators.min(0)]],
    yearBuilt: this.fb.control<number | null>(null, [Validators.min(1800), Validators.max(this.currentYear)])
  });

  readonly imageUrls = signal<string[]>([]);
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
        this.imageUrls.set(listing.imageUrls);
        this.existingLat = listing.lat ?? null;
        this.existingLng = listing.lng ?? null;
      });
    }
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

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrls.update((urls) => [...urls, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  addImageUrl(): void {
    const url = this.newImageUrl.trim();
    if (!url) return;
    this.imageUrls.update((urls) => [...urls, url]);
    this.newImageUrl = '';
  }

  removeImage(index: number): void {
    this.imageUrls.update((urls) => urls.filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.imageUrls().length) {
      this.notification.error('listingForm.atLeastOnePhoto');
      return;
    }

    const raw = this.form.getRawValue();
    const value: ListingInput = {
      ...raw,
      yearBuilt: raw.yearBuilt ?? undefined,
      imageUrls: this.imageUrls(),
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
      error: () => this.notification.error('listingForm.submitError')
    });
  }
}
