import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
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
      refreshToken: 'refresh-abc',
      user: { id: '1', email: 'agent@example.com', firstName: 'Ana', lastName: 'Lopez', roles: ['Owner'] }
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('reapp_token')).toBe('jwt-abc');
    expect(localStorage.getItem('reapp_refresh_token')).toBe('refresh-abc');
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

  it('logout() clears the session and localStorage, and best-effort revokes the refresh token', () => {
    service.login({ email: 'agent@example.com', password: 'secret' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush({
      token: 'jwt-abc',
      expiresAt: '2026-10-01T00:00:00Z',
      refreshToken: 'refresh-abc',
      user: { id: '1', email: 'agent@example.com', firstName: 'Ana', lastName: 'Lopez', roles: ['Owner'] }
    });
    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('reapp_token')).toBeNull();
    expect(localStorage.getItem('reapp_refresh_token')).toBeNull();
    expect(localStorage.getItem('reapp_user')).toBeNull();

    const logoutReq = httpMock.expectOne('/api/auth/logout');
    expect(logoutReq.request.body).toEqual({ refreshToken: 'refresh-abc' });
    logoutReq.flush(null);
  });

  it('refresh() exchanges the stored refresh token for a new session', () => {
    localStorage.setItem('reapp_refresh_token', 'old-refresh');

    let resolvedUser: unknown;
    service.refresh().subscribe((user) => (resolvedUser = user));

    const req = httpMock.expectOne('/api/auth/refresh');
    expect(req.request.body).toEqual({ refreshToken: 'old-refresh' });
    req.flush({
      token: 'jwt-new',
      expiresAt: '2026-10-01T00:00:00Z',
      refreshToken: 'new-refresh',
      user: { id: '1', email: 'agent@example.com', firstName: 'Ana', lastName: 'Lopez', roles: ['Owner'] }
    });

    expect((resolvedUser as { id: string }).id).toBe('1');
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('reapp_token')).toBe('jwt-new');
    expect(localStorage.getItem('reapp_refresh_token')).toBe('new-refresh');
  });

  it('refresh() dedupes concurrent calls into a single HTTP request', () => {
    localStorage.setItem('reapp_refresh_token', 'old-refresh');

    service.refresh().subscribe();
    service.refresh().subscribe();

    httpMock.expectOne('/api/auth/refresh').flush({
      token: 'jwt-new',
      expiresAt: '2026-10-01T00:00:00Z',
      refreshToken: 'new-refresh',
      user: { id: '1', email: 'agent@example.com', firstName: 'Ana', lastName: 'Lopez', roles: ['Owner'] }
    });
  });

  it('refresh() errors immediately when no refresh token is stored', () => {
    let error: unknown;
    service.refresh().subscribe({ error: (e) => (error = e) });

    expect(error).toBeTruthy();
    httpMock.expectNone('/api/auth/refresh');
  });

  // Regression guard: this service used to touch `localStorage` unconditionally, which threw
  // ReferenceError and broke the build during SSR/prerendering (no localStorage exists there,
  // simulated here via PLATFORM_ID: 'server').
  describe('on the server platform', () => {
    let serverService: AuthService;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: PLATFORM_ID, useValue: 'server' }
        ]
      });
      serverService = TestBed.inject(AuthService);
    });

    it('starts logged out without touching localStorage, and logout()/token stay safe', () => {
      expect(serverService.isAuthenticated()).toBe(false);
      expect(serverService.currentUser()).toBeNull();
      expect(serverService.token).toBeNull();
      expect(() => serverService.logout()).not.toThrow();
    });
  });
});
