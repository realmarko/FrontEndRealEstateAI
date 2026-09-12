import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, CurrencyInputDirective],
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
    imageUrl: ['https://picsum.photos/640/400', Validators.required]
  });

  private existingLat: number | null = null;
  private existingLng: number | null = null;

  constructor() {
    if (this.editingId) {
      this.listingService.fetchById(this.editingId).subscribe((listing) => {
        this.form.patchValue(listing);
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

  selectedFileName: string | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.form.patchValue({ imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value: ListingInput = {
      ...this.form.getRawValue(),
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
