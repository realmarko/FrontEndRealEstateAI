import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FormErrorComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/listings']),
      // A 403 here means AuthController.Login found valid credentials but the account's email
      // isn't confirmed yet — route straight to the verify-email screen (with the email
      // pre-filled and a resend option) instead of the dead-end "invalid credentials" message.
      error: (err: HttpErrorResponse) => {
        if (err.status === 403 && err.error?.requiresVerification) {
          this.notification.error('auth.errors.emailNotVerified');
          this.router.navigate(['/verify-email'], { queryParams: { email: err.error.email } });
          return;
        }
        this.notification.error('auth.errors.invalidCredentials');
      }
    });
  }
}
