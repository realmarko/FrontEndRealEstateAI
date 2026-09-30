import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FormErrorComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css'
})
export class VerifyEmailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);

  // Missing email means the visitor didn't arrive via Register()'s redirect or a Login() 403 — the
  // form still renders (unlike ResetPasswordComponent's invalid-link screen) since typing the code
  // in doesn't inherently need a known email, just one to submit it against.
  readonly email = signal(this.route.snapshot.queryParamMap.get('email') ?? '');
  readonly resending = signal(false);
  readonly verifying = signal(false);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  submit(): void {
    if (this.verifying()) return;
    if (!this.email()) {
      this.notification.error('verifyEmail.missingEmail');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.verifying.set(true);
    this.auth.verifyEmail(this.email(), this.form.getRawValue().code).subscribe({
      next: (user) => {
        this.verifying.set(false);
        this.notification.success('verifyEmail.success');
        this.router.navigate([user.roles.includes('Agent') ? '/agents/new' : '/listings']);
      },
      error: (err: HttpErrorResponse) => {
        this.verifying.set(false);
        if (err.status === 429) {
          this.notification.error('auth.errors.tooManyRequests');
          return;
        }
        // Backend rejects with this exact message when the account got verified elsewhere (e.g. a
        // stale second tab) — send the visitor to log in instead of letting them keep retrying a
        // code that can never succeed anymore.
        if (typeof err.error?.message === 'string' && err.error.message.includes('already verified')) {
          this.notification.success('verifyEmail.alreadyVerified');
          this.router.navigate(['/login']);
          return;
        }
        this.notification.error('verifyEmail.invalidCode');
      }
    });
  }

  resendCode(): void {
    if (this.resending() || !this.email()) return;

    this.resending.set(true);
    this.auth.resendVerificationCode(this.email()).subscribe({
      // Always resolves (backend never reveals whether the email exists/is already verified) —
      // same enumeration-safety reasoning as ForgotPasswordComponent's success screen.
      next: () => {
        this.resending.set(false);
        this.notification.success('verifyEmail.resendSuccess');
      },
      error: (err: HttpErrorResponse) => {
        this.resending.set(false);
        this.notification.error(err.status === 429 ? 'auth.errors.tooManyRequests' : 'verifyEmail.resendFailed');
      }
    });
  }
}
