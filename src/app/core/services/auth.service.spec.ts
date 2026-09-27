import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts with no authenticated user when localStorage is empty', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('login() stores the token/user and flips isAuthenticated on success', () => {
    let resolvedUser: unknown;
    service.login({ email: 'agent@example.com', password: 'secret' }).subscribe((user) => (resolvedUser = user));

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'agent@example.com', password: 'secret' });
    req.flush({
      token: 'jwt-abc',
      expiresAt: '2026-10-01T00:00:00Z',
      user: { id: '1', email: 'agent@example.com', firstName: 'Ana', lastName: 'Lopez', roles: ['Owner'] }
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('reapp_token')).toBe('jwt-abc');
    expect((resolvedUser as { firstName: string }).firstName).toBe('Ana');
  });

  it('forgotPassword() posts only the email, with no session side effects', () => {
    service.forgotPassword('user@example.com').subscribe();

    const req = httpMock.expectOne('/api/auth/forgot-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com' });
    req.flush(null);

    expect(service.isAuthenticated()).toBe(false);
  });

  it('resetPassword() posts email, token and the new password', () => {
    service.resetPassword('user@example.com', 'the-token', 'NewPassw0rd!').subscribe();

    const req = httpMock.expectOne('/api/auth/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'user@example.com',
      token: 'the-token',
      newPassword: 'NewPassw0rd!'
    });
    req.flush(null);
  });

  it('logout() clears the session and localStorage', () => {
    service.login({ email: 'agent@example.com', password: 'secret' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush({
      token: 'jwt-abc',
      expiresAt: '2026-10-01T00:00:00Z',
      user: { id: '1', email: 'agent@example.com', firstName: 'Ana', lastName: 'Lopez', roles: ['Owner'] }
    });
    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('reapp_token')).toBeNull();
    expect(localStorage.getItem('reapp_user')).toBeNull();
  });
});
