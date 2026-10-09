import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { passwordStrengthValidator } from '../../../shared/utils/password-strength';
import { UserRole } from '../../../core/models/user.model';
import { loadGoogleIdentity, setGoogleCredentialHandler } from '../../../core/utils/load-google-identity';
import { loadFacebookSdk, loginWithFacebookSdk } from '../../../core/utils/load-facebook-sdk';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FormErrorComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements AfterViewInit {
  @ViewChild('googleButton') private googleButtonEl?: ElementRef<HTMLDivElement>;

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
    role: ['Owner' as UserRole, Validators.required],
    acceptTerms: [false, Validators.requiredTrue]
  });

  async ngAfterViewInit(): Promise<void> {
    if (!this.googleButtonEl) return;

    try {
      await loadGoogleIdentity();
      // Reads the role dropdown fresh inside the callback (not captured here) — the visitor can
      // change it any time before actually clicking the Google button.
      setGoogleCredentialHandler(environment.googleClientId, (idToken) => this.onGoogleCredential(idToken));
      google.accounts.id.renderButton(this.googleButtonEl.nativeElement, {
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
        width: 320
      });
    } catch {
      // Same reasoning as LoginComponent — a blocked GIS script shouldn't alarm a visitor who's
      // just going to use the form below anyway.
    }
  }

  private onGoogleCredential(idToken: string): void {
    if (!this.requireAcceptedTerms()) return;

    const role = this.form.controls.role.value;
    this.auth.loginWithGoogle(idToken, role).subscribe({
      next: () => this.router.navigate(['/listings']),
      error: () => this.notification.error('auth.errors.googleSignInFailed')
    });
  }

  // Loads the SDK lazily, on click — see LoginComponent.onFacebookClick for why (no pre-rendered
  // button like Google's).
  async onFacebookClick(): Promise<void> {
    if (!this.requireAcceptedTerms()) return;

    try {
      await loadFacebookSdk(environment.facebookAppId);
      const accessToken = await loginWithFacebookSdk();
      const role = this.form.controls.role.value;
      this.auth.loginWithFacebook(accessToken, role).subscribe({
        next: () => this.router.navigate(['/listings']),
        error: () => this.notification.error('auth.errors.facebookSignInFailed')
      });
    } catch {
      // Same silent-fail reasoning as LoginComponent.onFacebookClick.
    }
  }

  // The checkbox's own Validators.requiredTrue already blocks the regular submit() button below,
  // but the Google/Facebook buttons sit outside the <form> (so markAllAsTouched() there wouldn't
  // show their error) and fire their own network call directly — this is the one guard both
  // share, surfacing the same validation error the form would show if submitted unchecked.
  private requireAcceptedTerms(): boolean {
    if (this.form.controls.acceptTerms.value) return true;
    this.form.controls.acceptTerms.markAsTouched();
    this.notification.error('auth.errors.mustAcceptTerms');
    return false;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();

    this.auth.register(payload).subscribe({
      next: () => {
        // No session yet — Register() no longer logs the visitor in (see AuthService.register).
        // The verify-email screen is where role-based routing (agents/new vs listings) actually
        // happens, once VerifyEmailComponent has a real logged-in user to read roles from.
        this.router.navigate(['/verify-email'], { queryParams: { email: payload.email } });
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
