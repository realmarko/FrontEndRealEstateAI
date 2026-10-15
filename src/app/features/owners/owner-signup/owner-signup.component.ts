import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerService } from '../../../core/services/owner.service';
import { toSlug } from '../../../core/services/owner-api.adapter';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PhoneInputDirective } from '../../../shared/directives/phone-input.directive';
import { SeoService } from '../../../core/services/seo.service';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Mirrors AgentSignupComponent's shape throughout, trimmed: no company/isIndependent/specialties.
@Component({
  selector: 'app-owner-signup',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PhoneInputDirective],
  templateUrl: './owner-signup.component.html',
  styleUrl: './owner-signup.component.css'
})
export class OwnerSignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ownerService = inject(OwnerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  private readonly notification = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  readonly isEditMode = this.route.snapshot.data['editMode'] === true;

  readonly submitting = signal(false);
  readonly loading = signal(this.isEditMode);
  readonly loadError = signal(false);

  readonly photoError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);
  private selectedPhoto: File | null = null;

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10)]],
    bio: ['']
  });

  constructor() {
    inject(SeoService).set({
      title: this.isEditMode ? 'Editar perfil de propietario' : 'Registrarse como propietario',
      description: 'Crea o edita tu perfil de propietario en Espacial.com.mx.',
      path: this.isEditMode ? '/owners/edit' : '/owners/new'
    });

    if (this.isEditMode) {
      this.loadMine();
    }
  }

  retryLoad(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.loadMine();
  }

  private loadMine(): void {
    this.ownerService.fetchMine().subscribe({
      next: (owner) => {
        this.form.patchValue({ phone: owner.phone, bio: owner.bio ?? '' });
        this.photoPreview.set(owner.photoUrl ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        if (err.status === 404) {
          this.router.navigate(['/owners/new']);
        } else {
          this.loading.set(false);
          this.loadError.set(true);
          this.notification.error('ownerSignup.loadError');
        }
      }
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      this.photoError.set(this.translation.t('ownerSignup.photoInvalidType'));
      this.selectedPhoto = null;
      this.photoPreview.set(null);
      input.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set(this.translation.t('ownerSignup.photoTooLarge'));
      this.selectedPhoto = null;
      this.photoPreview.set(null);
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
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { phone, bio } = this.form.getRawValue();
    const input = { phone, photo: this.selectedPhoto ?? undefined, bio: bio || undefined };

    const request = this.isEditMode ? this.ownerService.updateMine(input) : this.ownerService.createMine(input);
    request.subscribe({
      next: (owner) => {
        this.notification.success(this.isEditMode ? 'ownerSignup.updateSuccess' : 'ownerSignup.success');
        this.router.navigate(['/owners', toSlug(owner.name)]);
      },
      error: (err) => {
        // Create specifically rejects an Agent-role user with its own 400 — a distinct message
        // so that case doesn't read as a generic "something went wrong" submitError.
        if (!this.isEditMode && err.status === 400) {
          this.submitting.set(false);
          this.notification.error('ownerSignup.alreadyAgent');
          return;
        }
        // A row for this account can already exist here without the user ever having submitted
        // this form — an admin's free-text owner-contact on one of their listings auto-creates an
        // inactive Owner row by email, which this account's UserId gets linked to the moment its
        // email is verified (AuthController.ClaimOwnerProfileIfMatchingAsync). Create() then 409s
        // since that row (and its UserId) already exist — finish with updateMine instead of
        // showing an error, so the flow still completes like a normal first-time submit.
        if (!this.isEditMode && err.status === 409) {
          this.ownerService.updateMine(input).subscribe({
            next: (owner) => {
              this.submitting.set(false);
              this.notification.success('ownerSignup.success');
              this.router.navigate(['/owners', toSlug(owner.name)]);
            },
            error: () => {
              this.submitting.set(false);
              this.notification.error('ownerSignup.submitError');
            }
          });
          return;
        }
        this.submitting.set(false);
        this.notification.error(this.isEditMode ? 'ownerSignup.updateError' : 'ownerSignup.submitError');
      }
    });
  }
}
