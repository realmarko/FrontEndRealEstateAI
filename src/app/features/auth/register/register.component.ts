import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { passwordStrengthValidator } from '../../../shared/utils/password-strength';
import { UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FormErrorComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    // minLength(8) matches Program.cs's Identity.Password.RequiredLength; passwordStrengthValidator
    // matches the RequireUppercase/RequireLowercase/RequireDigit/RequireNonAlphanumeric defaults
    // Identity keeps since Program.cs doesn't override them — catching a weak password here means
    // the visitor sees exactly what's missing instead of AuthController.Register's generic failure.
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
    role: ['Owner' as UserRole, Validators.required]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();

    this.auth.register(payload).subscribe({
      next: () => {
        this.notification.success('register.success');
        this.router.navigate([payload.role === 'Agent' ? '/agents/new' : '/listings']);
      },
      error: (err) => {
        // Identity validation failures (result.Errors.Select(e => e.Description) in
        // AuthController.Register) arrive as a plain array of English description strings — the
        // client-side validators above should catch a weak password before it gets this far, but
        // this still tells the visitor which specific rule failed instead of a generic message,
        // in case Identity's policy ever diverges from passwordStrengthValidator.
        const messages: string[] = Array.isArray(err?.error) ? err.error : [];
        const key = messages.some((m) => /taken|already/i.test(m))
          ? 'auth.errors.emailTaken'
          : messages.some((m) => /password/i.test(m))
            ? 'auth.errors.weakPassword'
            : 'auth.errors.registerFailed';
        this.notification.error(key);
      }
    });
  }
}
