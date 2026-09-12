import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { BrokerageService } from '../../../core/services/brokerage.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-agent-signup',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './agent-signup.component.html',
  styleUrl: './agent-signup.component.css'
})
export class AgentSignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly agentService = inject(AgentService);
  private readonly brokerageService = inject(BrokerageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  readonly isEditMode = this.route.snapshot.data['editMode'] === true;

  readonly submitting = signal(false);
  readonly loading = signal(this.isEditMode);
  readonly loadError = signal(false);
  readonly brokerages = signal<string[]>([]);

  readonly photoError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);
  private selectedPhoto: File | null = null;

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.minLength(7)]],
    company: [''],
    isIndependent: [false],
    bio: [''],
    specialties: ['']
  });

  constructor() {
    this.brokerageService.search().subscribe((names) => this.brokerages.set(names));

    this.form.controls.isIndependent.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((isIndependent) => {
      if (isIndependent) {
        this.form.controls.company.setValue('');
        this.form.controls.company.disable();
      } else {
        this.form.controls.company.enable();
      }
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
    this.agentService.fetchMine().subscribe({
      next: (agent) => {
        this.form.patchValue({
          phone: agent.phone,
          company: agent.company ?? '',
          isIndependent: agent.isIndependent,
          bio: agent.bio ?? '',
          specialties: agent.specialties.join(', ')
        });
        this.photoPreview.set(agent.photoUrl ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        if (err.status === 404) {
          this.router.navigate(['/agents/new']);
        } else {
          this.loading.set(false);
          this.loadError.set(true);
          this.notification.error('agentSignup.loadError');
        }
      }
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      this.photoError.set(this.translation.t('agentSignup.photoInvalidType'));
      this.selectedPhoto = null;
      this.photoPreview.set(null);
      input.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      this.photoError.set(this.translation.t('agentSignup.photoTooLarge'));
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
    const { phone, company, isIndependent, bio, specialties } = this.form.getRawValue();
    const input = {
      phone,
      company: company || undefined,
      isIndependent,
      photo: this.selectedPhoto ?? undefined,
      bio: bio || undefined,
      specialties: specialties
        ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
    };

    const request = this.isEditMode ? this.agentService.updateMine(input) : this.agentService.createMine(input);
    request.subscribe({
      next: (agent) => {
        this.notification.success(this.isEditMode ? 'agentSignup.updateSuccess' : 'agentSignup.success');
        this.router.navigate(['/agents', agent.id]);
      },
      error: () => {
        this.submitting.set(false);
        this.notification.error(this.isEditMode ? 'agentSignup.updateError' : 'agentSignup.submitError');
      }
    });
  }
}
