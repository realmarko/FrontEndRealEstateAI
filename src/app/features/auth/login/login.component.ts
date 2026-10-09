import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { FormErrorComponent } from '../../../shared/components/form-error/form-error.component';
import { loadGoogleIdentity, setGoogleCredentialHandler } from '../../../core/utils/load-google-identity';
import { loadFacebookSdk, loginWithFacebookSdk } from '../../../core/utils/load-facebook-sdk';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FormErrorComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleButton') private googleButtonEl?: ElementRef<HTMLDivElement>;

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  async ngAfterViewInit(): Promise<void> {
    if (!this.googleButtonEl) return;

    try {
      await loadGoogleIdentity();
      // No role sent — a brand-new account created from this button falls back to Buyer, same
      // as AuthController's role switch does for any unrecognized/missing role.
      setGoogleCredentialHandler(environment.googleClientId, (idToken) => this.onGoogleCredential(idToken));
      google.accounts.id.renderButton(this.googleButtonEl.nativeElement, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: 320
      });
    } catch {
      // Ad-blockers/extensions commonly block accounts.google.com — the password form below
      // still works, so this fails silently rather than showing an alarming error toast for a
      // sign-in method the visitor may not even have been trying to use.
    }
  }

  private onGoogleCredential(idToken: string): void {
    this.auth.loginWithGoogle(idToken).subscribe({
      next: () => this.router.navigate(['/listings']),
      error: () => this.notification.error('auth.errors.googleSignInFailed')
    });
  }

  // Loads the SDK lazily, on click, rather than in ngAfterViewInit like Google's — Facebook has
  // no equivalent to Google's pre-rendered button (renderButton), so there's nothing to show
  // until the visitor actually clicks our own button.
  async onFacebookClick(): Promise<void> {
    try {
      await loadFacebookSdk(environment.facebookAppId);
      const accessToken = await loginWithFacebookSdk();
      // No role sent here — same reasoning as the Google button above.
      this.auth.loginWithFacebook(accessToken).subscribe({
        next: () => this.router.navigate(['/listings']),
        error: () => this.notification.error('auth.errors.facebookSignInFailed')
      });
    } catch {
      // Cancelled/denied login or a blocked connect.facebook.net script — same silent-fail
      // reasoning as the Google button's ngAfterViewInit catch.
    }
  }

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
