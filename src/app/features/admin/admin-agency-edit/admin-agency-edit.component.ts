import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { toSlug } from '../../../core/services/brokerage-api.adapter';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';

// Mirrors AgencyCreateComponent's identical client-side check for the logo picker.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// "19.04, -98.20" (comma or whitespace-separated, e.g. pasted straight from Google Maps'
// coordinate display) → { latitude, longitude }, or null — same parsing AdminFraccionamientosComponent
// uses for the same kind of admin-pasted-coordinate input.
function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const parts = text.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

// Admin-only: edits ANY brokerage by id (unlike AgencyEditComponent, which only a *member* agent
// can use on their own brokerage, and only on a subset of fields). Reached from the "Editar
// (admin)" link on AgencyDetailComponent, shown to any Admin regardless of a.canEdit.
@Component({
  selector: 'app-admin-agency-edit',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormErrorComponent],
  templateUrl: './admin-agency-edit.component.html',
  styleUrl: '../../agencies/agency-edit/agency-edit.component.css'
})
export class AdminAgencyEditComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brokerageService = inject(BrokerageService);
  private readonly notification = inject(NotificationService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly photoPreview = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  private selectedPhoto: File | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    coordinates: [''],
    address: ['', [Validators.maxLength(300)]],
    phone: ['', [Validators.minLength(7), Validators.maxLength(30)]],
    email: ['', [Validators.email, Validators.maxLength(320)]],
    workingHours: ['', [Validators.maxLength(200)]],
    website: ['', [Validators.maxLength(2048)]],
    state: ['', [Validators.maxLength(150)]],
    city: ['', [Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(3000)]],
    facebookUrl: ['', [Validators.maxLength(2048)]],
    instagramUrl: ['', [Validators.maxLength(2048)]]
  });

  constructor() {
    if (!this.id) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.brokerageService.fetchById(this.id).subscribe({
      next: (agency) => {
        this.form.patchValue({
          name: agency.name,
          coordinates: agency.latitude !== undefined && agency.longitude !== undefined ? `${agency.latitude}, ${agency.longitude}` : '',
          address: agency.address ?? '',
          phone: agency.phone ?? '',
          email: agency.email ?? '',
          workingHours: agency.workingHours ?? '',
          website: agency.website ?? '',
          state: agency.state ?? '',
          city: agency.city ?? '',
          description: agency.description ?? '',
          facebookUrl: agency.facebookUrl ?? '',
          instagramUrl: agency.instagramUrl ?? ''
        });
        this.photoPreview.set(agency.logoUrl ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      }
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

    const v = this.form.getRawValue();
    const coordsText = v.coordinates.trim();
    const coordinates = coordsText ? parseCoordinates(coordsText) : null;
    if (coordsText && !coordinates) {
      this.notification.error('adminAgencyEdit.invalidCoordinates');
      return;
    }

    this.submitting.set(true);
    this.brokerageService
      .adminUpdate(this.id, {
        name: v.name.trim(),
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        address: v.address.trim() || undefined,
        phone: v.phone.trim() || undefined,
        email: v.email.trim() || undefined,
        workingHours: v.workingHours.trim() || undefined,
        website: v.website.trim() || undefined,
        state: v.state.trim() || undefined,
        city: v.city.trim() || undefined,
        description: v.description.trim() || undefined,
        facebookUrl: v.facebookUrl.trim() || undefined,
        instagramUrl: v.instagramUrl.trim() || undefined,
        logo: this.selectedPhoto ?? undefined
      })
      .subscribe({
        next: (agency) => {
          this.submitting.set(false);
          this.notification.success('adminAgencyEdit.success');
          this.router.navigate(['/inmobiliarias', toSlug(agency.name)]);
        },
        error: () => {
          this.submitting.set(false);
          this.notification.error('adminAgencyEdit.error');
        }
      });
  }
}
