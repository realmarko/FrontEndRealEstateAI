import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  private readonly notification = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  readonly submitting = signal(false);
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

    this.form.controls.isIndependent.valueChanges.subscribe((isIndependent) => {
      if (isIndependent) {
        this.form.controls.company.setValue('');
        this.form.controls.company.disable();
      } else {
        this.form.controls.company.enable();
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
    this.agentService.createMine({
      phone,
      company: company || undefined,
      isIndependent,
      photo: this.selectedPhoto ?? undefined,
      bio: bio || undefined,
      specialties: specialties
        ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
    }).subscribe({
      next: () => {
        this.notification.success('agentSignup.success');
        this.router.navigate(['/agents']);
      },
      error: () => {
        this.submitting.set(false);
        this.notification.error('agentSignup.submitError');
      }
    });
  }
}
