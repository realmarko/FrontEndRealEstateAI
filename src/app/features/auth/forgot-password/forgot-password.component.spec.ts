import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  function createComponent(): ForgotPasswordComponent {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['forgotPassword']);
    notificationSpy = jasmine.createSpyObj('NotificationService', ['error', 'success']);

    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotificationService, useValue: notificationSpy }
      ]
    });
  });

  it('does not call the backend when the email is invalid', () => {
    const component = createComponent();
    component.form.controls.email.setValue('not-an-email');

    component.submit();

    expect(authServiceSpy.forgotPassword).not.toHaveBeenCalled();
    expect(component.form.controls.email.touched).toBe(true);
  });

  it('shows the fixed confirmation state on success, regardless of the response payload', () => {
    authServiceSpy.forgotPassword.and.returnValue(of(undefined));
    const component = createComponent();
    component.form.controls.email.setValue('user@example.com');

    component.submit();

    expect(authServiceSpy.forgotPassword).toHaveBeenCalledWith('user@example.com');
    expect(component.submitted()).toBe(true);
  });

  it('shows an error notification on a network/rate-limit failure without flipping to confirmed', () => {
    authServiceSpy.forgotPassword.and.returnValue(throwError(() => new Error('network error')));
    const component = createComponent();
    component.form.controls.email.setValue('user@example.com');

    component.submit();

    expect(notificationSpy.error).toHaveBeenCalledWith('auth.errors.forgotPasswordFailed');
    expect(component.submitted()).toBe(false);
  });
});
