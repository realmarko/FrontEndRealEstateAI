import { convertToParamMap, provideRouter, ActivatedRoute, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;
  let router: Router;

  function createComponent(queryParams: Record<string, string>): ResetPasswordComponent {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['resetPassword']);
    notificationSpy = jasmine.createSpyObj('NotificationService', ['error', 'success']);

    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
        }
      ]
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('is invalid when the email/token query params are missing', () => {
    const component = createComponent({});
    expect(component.linkIsValid).toBe(false);
  });

  it('is invalid when only one of email/token is present', () => {
    const component = createComponent({ email: 'user@example.com' });
    expect(component.linkIsValid).toBe(false);
  });

  it('is valid when both email and token are present', () => {
    const component = createComponent({ email: 'user@example.com', token: 'the-token' });
    expect(component.linkIsValid).toBe(true);
  });

  it('flags a form error when the passwords do not match', () => {
    const component = createComponent({ email: 'user@example.com', token: 'the-token' });
    component.form.controls.newPassword.setValue('Passw0rd!');
    component.form.controls.confirmPassword.setValue('Different1!');

    expect(component.form.errors).toEqual({ passwordMismatch: true });
  });

  it('does not submit when passwords do not match', () => {
    const component = createComponent({ email: 'user@example.com', token: 'the-token' });
    component.form.controls.newPassword.setValue('Passw0rd!');
    component.form.controls.confirmPassword.setValue('Different1!');

    component.submit();

    expect(authServiceSpy.resetPassword).not.toHaveBeenCalled();
  });

  it('submits the email/token from the URL with the new password, then redirects to login', () => {
    const component = createComponent({ email: 'user@example.com', token: 'the-token' });
    authServiceSpy.resetPassword.and.returnValue(of(undefined));
    component.form.controls.newPassword.setValue('NewPassw0rd!');
    component.form.controls.confirmPassword.setValue('NewPassw0rd!');

    component.submit();

    expect(authServiceSpy.resetPassword).toHaveBeenCalledWith('user@example.com', 'the-token', 'NewPassw0rd!');
    expect(notificationSpy.success).toHaveBeenCalledWith('resetPassword.success');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shows an error notification when the reset call fails (e.g. an expired token)', () => {
    const component = createComponent({ email: 'user@example.com', token: 'the-token' });
    authServiceSpy.resetPassword.and.returnValue(throwError(() => new Error('expired')));
    component.form.controls.newPassword.setValue('NewPassw0rd!');
    component.form.controls.confirmPassword.setValue('NewPassw0rd!');

    component.submit();

    expect(notificationSpy.error).toHaveBeenCalledWith('auth.errors.resetPasswordFailed');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
