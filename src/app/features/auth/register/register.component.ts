import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);

  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Owner' as UserRole, Validators.required]
  });

  submit(): void {
    console.log('[register] submit clicked, form valid?', this.form.valid, 'errors:', this.collectErrors());

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    const payload = this.form.getRawValue();
    console.log('[register] sending payload', { ...payload, password: '(hidden)' });

    this.auth.register(payload).subscribe({
      next: (res) => {
        console.log('[register] service responded OK', res);
        this.router.navigate([payload.role === 'Agent' ? '/agents/new' : '/listings']);
      },
      error: (err) => {
        console.log('[register] service responded with error', err);
        const messages: string[] = Array.isArray(err?.error) ? err.error : [];
        const key = messages.some((m) => /taken|already/i.test(m))
          ? 'auth.errors.emailTaken'
          : 'auth.errors.registerFailed';
        this.errorMessage.set(this.translation.t(key));
      }
    });
  }

  private collectErrors(): Record<string, unknown> {
    const errors: Record<string, unknown> = {};
    for (const name of Object.keys(this.form.controls)) {
      const control = this.form.get(name);
      if (control?.errors) errors[name] = control.errors;
    }
    return errors;
  }
}
