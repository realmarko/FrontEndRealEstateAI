import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ReactiveFormsModule, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { passwordStrengthValidator } from '../../../shared/utils/password-strength';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FormErrorComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);

  // Missing either param means the visitor didn't arrive via a real reset-password link (typed
  // the URL by hand, or an old/truncated link) — same "get a new link" dead end as an
  // expired/invalid token, so the form never even renders rather than failing on submit.
  private readonly email = this.route.snapshot.queryParamMap.get('email');
  private readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly linkIsValid = !!this.email && !!this.token;

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordsMatch }
  );

  submit(): void {
    if (this.form.invalid || !this.email || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.resetPassword(this.email, this.token, this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.notification.success('resetPassword.success');
        this.router.navigate(['/login']);
      },
      // ResetPassword's 400 for an invalid/expired token (message: "Invalid or expired reset
      // link.") is common enough — the visitor clicked an old email — to get its own message
      // pointing them at requesting a new link, instead of the generic fallback. 429 comes from
      // the same "forgot-password" rate-limit policy this endpoint shares (Program.cs), so it
      // gets the same distinct message as ForgotPasswordComponent.
      error: (err: HttpErrorResponse) => {
        const key =
          err.status === 429
            ? 'auth.errors.tooManyRequests'
            : err.status === 400 && typeof err.error?.message === 'string' && err.error.message.includes('expired')
              ? 'auth.errors.invalidResetLink'
              : 'auth.errors.resetPasswordFailed';
        this.notification.error(key);
      }
    });
  }
}
