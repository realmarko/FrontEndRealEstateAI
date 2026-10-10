import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { toSlug } from '../../../core/services/brokerage-api.adapter';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { loadGoogleMaps } from '../../../core/utils/load-google-maps';

// Mirrors AgencyEditComponent's identical client-side check for the logo picker.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Admin-only: reached from the map's "Agregar inmobiliaria" tool (toggleAddBrokerageMode /
// confirmLocation in map-view.component.ts), which places a pin and navigates here with
// ?lat&lng — guarded by hasCoordinatesGuard + roleGuard('Admin') on the route, same pattern as
// 'listings/new'. Pins a brand-new, location-bearing Brokerage row (BrokeragesController.Create)
// — distinct from AgencyEditComponent, which only ever edits a brokerage an agent already
// belongs to and never sets location/contact fields.
@Component({
  selector: 'app-agency-create',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormErrorComponent],
  templateUrl: './agency-create.component.html',
  styleUrl: '../agency-edit/agency-edit.component.css'
})
export class AgencyCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brokerageService = inject(BrokerageService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // hasCoordinatesGuard already refuses the route without both present and finite.
  private readonly lat = Number(this.route.snapshot.queryParamMap.get('lat'));
  private readonly lng = Number(this.route.snapshot.queryParamMap.get('lng'));

  readonly submitting = signal(false);
  readonly photoPreview = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  private selectedPhoto: File | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    address: [''],
    phone: ['', [Validators.minLength(7), Validators.maxLength(30)]],
    email: ['', [Validators.email, Validators.maxLength(320)]],
    workingHours: ['', [Validators.maxLength(200)]],
    website: ['', [Validators.maxLength(2048)]]
  });

  constructor() {
    this.reverseGeocodeAddress(this.lat, this.lng);
  }

  // Best-effort autofill, same reasoning as ListingFormComponent.reverseGeocodeAddress — never
  // blocks the form, and only fills the field while it's still untouched.
  private reverseGeocodeAddress(lat: number, lng: number): void {
    loadGoogleMaps()
      .then(() => {
        new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
          if (status !== 'OK' || !results?.length) return;
          if (this.form.controls.address.value) return;
          this.form.patchValue({ address: results[0].formatted_address });
        });
      })
      .catch(() => {
        // Same silent-fail reasoning as the listing form — the address field just stays empty
        // and editable.
      });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      this.photoError.set(this.translation.t('agencyCreate.photoInvalidType'));
      input.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set(this.translation.t('agencyCreate.photoTooLarge'));
      input.value = '';
      return;
    }

    this.photoError.set(null);
    this.selectedPhoto = file;

    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.brokerageService
      .create({
        name: v.name.trim(),
        latitude: this.lat,
        longitude: this.lng,
        address: v.address.trim() || undefined,
        phone: v.phone.trim() || undefined,
        email: v.email.trim() || undefined,
        workingHours: v.workingHours.trim() || undefined,
        website: v.website.trim() || undefined,
        photo: this.selectedPhoto ?? undefined
      })
      .subscribe({
        next: (agency) => {
          this.submitting.set(false);
          this.notification.success('agencyCreate.success');
          this.router.navigate(['/inmobiliarias', toSlug(agency.name)]);
        },
        error: () => {
          this.submitting.set(false);
          this.notification.error('agencyCreate.error');
        }
      });
  }
}
