import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly notification = inject(NotificationService);

  // The backend always returns 204 whether or not the email is registered (so this screen can't
  // be used to enumerate accounts) — this flips to a fixed confirmation message on ANY successful
  // response, never a per-account result.
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => this.submitted.set(true),
      // A network/rate-limit failure is the only thing that lands here — a registered vs.
      // unregistered email both resolve as success above.
      error: () => this.notification.error('auth.errors.forgotPasswordFailed')
    });
  }
}
