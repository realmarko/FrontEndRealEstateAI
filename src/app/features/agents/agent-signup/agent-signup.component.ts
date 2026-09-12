import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
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
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  protected readonly auth = inject(AuthService);

  readonly errorMessage = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly photoError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);
  private selectedPhoto: File | null = null;

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.minLength(7)]],
    company: ['']
  });

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

    this.errorMessage.set(null);
    this.submitting.set(true);
    const { phone, company } = this.form.getRawValue();
    this.agentService.createMine({
      phone,
      company: company || undefined,
      photo: this.selectedPhoto ?? undefined
    }).subscribe({
      next: () => this.router.navigate(['/agents']),
      error: () => {
        this.submitting.set(false);
        this.errorMessage.set(this.translation.t('agentSignup.submitError'));
      }
    });
  }
}
